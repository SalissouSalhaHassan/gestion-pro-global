-- =============================================================================
-- GESTION PRO GLOBAL - ATOMIC POS CHECKOUT & STOCK DEDUCTION
-- Date: 2026-09-12
-- Description:
--   Implements atomic transaction for POS sales to eliminate race conditions
--   when multiple cashiers sell items simultaneously.
--   Guarantees ACID properties: Invoice, items, stock deduction, inventory
--   movements, and payments succeed together or rollback completely.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.atomic_process_pos_sale(
    p_invoice JSONB,
    p_items JSONB,
    p_movements JSONB,
    p_payments JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_invoice_id BIGINT;
    v_item JSONB;
    v_art_id BIGINT;
    v_depot_nom TEXT;
    v_depot_id BIGINT;
    v_qte NUMERIC;
    v_org_id UUID;
    v_stock_id BIGINT;
    v_result JSONB;
BEGIN
    -- Extract organization_id safely
    v_org_id := NULLIF(p_invoice->>'organization_id', '')::UUID;

    -- 1. Insert Invoice into factures
    INSERT INTO public.factures (
        client_id,
        vendeur,
        date_facture,
        total_ht,
        total_ttc,
        total_tva,
        montant_paye,
        montant_restant,
        statut,
        bl_number,
        emplacement,
        organization_id
    )
    VALUES (
        (p_invoice->>'client_id')::BIGINT,
        p_invoice->>'vendeur',
        (p_invoice->>'date_facture')::DATE,
        COALESCE((p_invoice->>'total_ht')::NUMERIC, 0),
        COALESCE((p_invoice->>'total_ttc')::NUMERIC, 0),
        COALESCE((p_invoice->>'total_tva')::NUMERIC, 0),
        COALESCE((p_invoice->>'montant_paye')::NUMERIC, 0),
        COALESCE((p_invoice->>'montant_restant')::NUMERIC, 0),
        COALESCE(p_invoice->>'statut', 'Payée'),
        p_invoice->>'bl_number',
        p_invoice->>'emplacement',
        v_org_id
    )
    RETURNING id INTO v_invoice_id;

    -- 2. Insert Items & Perform ATOMIC Stock Deductions
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_art_id := (v_item->>'article_id')::BIGINT;
        v_qte := COALESCE((v_item->>'qte')::NUMERIC, 1);
        v_depot_nom := COALESCE(v_item->>'depot_origine', p_invoice->>'emplacement', 'BOUTIQUE');
        v_depot_id := NULLIF(v_item->>'depot_id', '')::BIGINT;

        -- Insert Facture Item
        INSERT INTO public.facture_items (
            facture_id,
            article_id,
            qte,
            pu_ht,
            pu_ttc,
            total_item_ht,
            total_item_ttc,
            taux_tva_item,
            montant_tva_item,
            depot_id,
            depot_origine,
            organization_id
        )
        VALUES (
            v_invoice_id,
            v_art_id,
            v_qte,
            COALESCE((v_item->>'pu_ht')::NUMERIC, 0),
            COALESCE((v_item->>'pu_ttc')::NUMERIC, 0),
            COALESCE((v_item->>'total_item_ht')::NUMERIC, 0),
            COALESCE((v_item->>'total_item_ttc')::NUMERIC, 0),
            COALESCE((v_item->>'taux_tva_item')::NUMERIC, 0),
            COALESCE((v_item->>'montant_tva_item')::NUMERIC, 0),
            v_depot_id,
            v_depot_nom,
            v_org_id
        );

        -- ATOMIC STOCK DEDUCTION WITH ROW-LEVEL LOCKING
        v_stock_id := NULL;
        UPDATE public.stocks
        SET quantite = quantite - v_qte
        WHERE article_id = v_art_id
          AND (
              (v_depot_nom IS NOT NULL AND LOWER(TRIM(depot_nom)) = LOWER(TRIM(v_depot_nom)))
              OR (v_depot_id IS NOT NULL AND warehouse_id = v_depot_id)
          )
          AND (organization_id = v_org_id OR (organization_id IS NULL AND v_org_id IS NULL))
        RETURNING id INTO v_stock_id;

        -- If no matching stock row existed, create one with negative/consumed balance
        IF v_stock_id IS NULL THEN
            INSERT INTO public.stocks (
                article_id,
                depot_nom,
                warehouse_id,
                quantite,
                organization_id
            )
            VALUES (
                v_art_id,
                v_depot_nom,
                v_depot_id,
                -v_qte,
                v_org_id
            );
        END IF;
    END LOOP;

    -- 3. Insert Inventory Movements (Mouvements)
    IF p_movements IS NOT NULL AND jsonb_array_length(p_movements) > 0 THEN
        INSERT INTO public.mouvements (
            article_id,
            nr_doc,
            date_mouvement,
            fournisseur_client,
            entree,
            sortie,
            quantite,
            pv,
            type,
            depot,
            utilisateur,
            organization_id
        )
        SELECT
            (m->>'article_id')::BIGINT,
            COALESCE(m->>'nr_doc', p_invoice->>'bl_number'),
            COALESCE((m->>'date_mouvement')::TIMESTAMPTZ, now()),
            m->>'fournisseur_client',
            0,
            (m->>'sortie')::NUMERIC,
            -(m->>'sortie')::NUMERIC,
            COALESCE((m->>'pv')::NUMERIC, 0),
            COALESCE(m->>'type', 'VENTE_POS'),
            m->>'depot',
            m->>'utilisateur',
            v_org_id
        FROM jsonb_array_elements(p_movements) AS m;
    END IF;

    -- 4. Insert Payments (Paiements)
    IF p_payments IS NOT NULL AND jsonb_array_length(p_payments) > 0 THEN
        INSERT INTO public.paiements (
            facture_id,
            date_operation,
            montant_regle,
            moyen_reglement,
            reference_paiement,
            utilisateur,
            user_id,
            regle,
            avance_client_id,
            organization_id
        )
        SELECT
            v_invoice_id,
            COALESCE((p->>'date_operation')::DATE, CURRENT_DATE),
            (p->>'montant_regle')::NUMERIC,
            p->>'moyen_reglement',
            COALESCE(p->>'reference_paiement', 'REG-' || v_invoice_id),
            p->>'utilisateur',
            NULLIF(p->>'user_id', '')::BIGINT,
            COALESCE((p->>'regle')::BOOLEAN, true),
            NULLIF(p->>'avance_client_id', '')::BIGINT,
            v_org_id
        FROM jsonb_array_elements(p_payments) AS p;
    END IF;

    -- 5. Build and return created invoice JSON
    SELECT jsonb_build_object(
        'id', f.id,
        'bl_number', f.bl_number,
        'date_facture', f.date_facture,
        'total_ht', f.total_ht,
        'total_ttc', f.total_ttc,
        'total_tva', f.total_tva,
        'montant_paye', f.montant_paye,
        'montant_restant', f.montant_restant,
        'statut', f.statut,
        'client_id', f.client_id,
        'vendeur', f.vendeur,
        'organization_id', f.organization_id
    ) INTO v_result
    FROM public.factures f
    WHERE f.id = v_invoice_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.atomic_process_pos_sale(JSONB, JSONB, JSONB, JSONB) TO authenticated, anon;
