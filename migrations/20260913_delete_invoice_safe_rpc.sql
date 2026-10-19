-- =============================================================================
-- GESTION PRO GLOBAL - SAFE INVOICE DELETION & STOCK REVERSAL RPC
-- Description:
--   Implements atomic deletion / cancellation of invoices.
--   Restores product stock back to original depots and creates compensating movements.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.delete_invoice_safe(
    p_invoice_id BIGINT,
    p_user_id BIGINT DEFAULT NULL,
    p_username TEXT DEFAULT 'System'
)
RETURNS JSONB AS $$
DECLARE
    v_invoice RECORD;
    v_item RECORD;
    v_org_id UUID;
    v_depot_nom TEXT;
    v_depot_id BIGINT;
    v_stock RECORD;
    v_stock_id BIGINT;
    v_old_qty NUMERIC;
    v_new_qty NUMERIC;
BEGIN
    -- 1. Fetch invoice
    SELECT * INTO v_invoice
    FROM public.factures
    WHERE id = p_invoice_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Facture introuvable');
    END IF;

    IF v_invoice.is_deleted = true THEN
        RETURN jsonb_build_object('ok', true, 'message', 'Facture déjà supprimée');
    END IF;

    v_org_id := v_invoice.organization_id;

    -- 2. Restore stocks for each item in facture_items
    FOR v_item IN 
        SELECT fi.*, a.designation AS art_designation
        FROM public.facture_items fi
        LEFT JOIN public.articles a ON a.id = fi.article_id
        WHERE fi.facture_id = p_invoice_id
    LOOP
        -- Determine target depot
        v_depot_nom := COALESCE(v_item.depot_origine, v_invoice.emplacement, 'Boutique');
        v_depot_id := v_item.depot_id;

        -- Find matching stock row (lock row for update)
        v_stock_id := NULL;
        SELECT id, quantite INTO v_stock
        FROM public.stocks
        WHERE article_id = v_item.article_id
          AND (
              (v_depot_nom IS NOT NULL AND LOWER(TRIM(depot_nom)) = LOWER(TRIM(v_depot_nom)))
              OR (v_depot_id IS NOT NULL AND warehouse_id = v_depot_id)
          )
          AND (organization_id = v_org_id OR (organization_id IS NULL AND v_org_id IS NULL))
        LIMIT 1
        FOR UPDATE;

        IF FOUND THEN
            v_old_qty := COALESCE(v_stock.quantite, 0);
            v_new_qty := v_old_qty + COALESCE(v_item.qte, 0);

            UPDATE public.stocks
            SET quantite = v_new_qty
            WHERE id = v_stock.id;
        ELSE
            v_old_qty := 0;
            v_new_qty := COALESCE(v_item.qte, 0);

            INSERT INTO public.stocks (
                article_id,
                depot_nom,
                warehouse_id,
                quantite,
                organization_id
            )
            VALUES (
                v_item.article_id,
                v_depot_nom,
                v_depot_id,
                v_new_qty,
                v_org_id
            )
            RETURNING id INTO v_stock_id;
        END IF;

        -- Record compensating movement (ENTREE - ANNULATION_FACTURE)
        INSERT INTO public.mouvements (
            article_id,
            nr_doc,
            date_mouvement,
            fournisseur_client,
            entree,
            sortie,
            quantite,
            pv,
            stock_avant,
            stock_apres,
            type,
            depot,
            utilisateur,
            organization_id
        )
        VALUES (
            v_item.article_id,
            'ANN-' || COALESCE(v_invoice.bl_number, p_invoice_id::text),
            now(),
            'Annulation Facture #' || COALESCE(v_invoice.bl_number, p_invoice_id::text),
            COALESCE(v_item.qte, 0),
            0,
            COALESCE(v_item.qte, 0),
            COALESCE(v_item.pu_ht, 0),
            v_old_qty,
            v_new_qty,
            'ENTREE_ANNULATION',
            v_depot_nom,
            COALESCE(p_username, 'System'),
            v_org_id
        );
    END LOOP;

    -- 3. Adjust client balance if needed (decrease credit by unpaid remaining balance)
    IF v_invoice.client_id IS NOT NULL AND COALESCE(v_invoice.montant_restant, 0) > 0 THEN
        UPDATE public.clients
        SET credit_facture = GREATEST(0, COALESCE(credit_facture, 0) - COALESCE(v_invoice.montant_restant, 0))
        WHERE id = v_invoice.client_id;
    END IF;

    -- 4. Mark invoice as deleted and cancelled
    UPDATE public.factures
    SET is_deleted = true,
        statut = 'Annulée',
        deleted_at = now(),
        updated_at = now()
    WHERE id = p_invoice_id;

    RETURN jsonb_build_object(
        'ok', true,
        'message', 'Facture annulée et stock réintégré avec succès'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.delete_invoice_safe(BIGINT, BIGINT, TEXT) TO authenticated, anon, service_role;
