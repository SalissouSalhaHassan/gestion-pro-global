-- =============================================================================
-- Migration: 20260905_add_organization_id_to_missing_tables.sql
-- Description: Adds organization_id to remaining business tables (avances_clients, paiements, bons_commande)
--              and backfills existing records safely from parent entities.
-- =============================================================================

-- 1. Table: avances_clients
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'avances_clients') THEN
        ALTER TABLE public.avances_clients ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        
        -- Backfill from linked client
        UPDATE public.avances_clients a
        SET organization_id = c.organization_id
        FROM public.clients c
        WHERE a.client_id = c.id AND a.organization_id IS NULL;

        -- Fallback default for any remaining nulls
        UPDATE public.avances_clients
        SET organization_id = '00000000-0000-0000-0000-000000000001'
        WHERE organization_id IS NULL;

        CREATE INDEX IF NOT EXISTS idx_avances_clients_organization_id ON public.avances_clients(organization_id);
    END IF;
END $$;

-- 2. Table: paiements
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'paiements') THEN
        ALTER TABLE public.paiements ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

        -- Backfill from linked facture
        UPDATE public.paiements p
        SET organization_id = f.organization_id
        FROM public.factures f
        WHERE p.facture_id = f.id AND p.organization_id IS NULL;

        -- Backfill from linked achat
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'achats') THEN
            UPDATE public.paiements p
            SET organization_id = a.organization_id
            FROM public.achats a
            WHERE p.achat_id = a.id AND p.organization_id IS NULL;
        END IF;

        -- Fallback default for any remaining nulls
        UPDATE public.paiements
        SET organization_id = '00000000-0000-0000-0000-000000000001'
        WHERE organization_id IS NULL;

        CREATE INDEX IF NOT EXISTS idx_paiements_organization_id ON public.paiements(organization_id);
    END IF;
END $$;

-- 3. Table: bons_commande
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bons_commande') THEN
        ALTER TABLE public.bons_commande ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

        -- Backfill from linked fournisseur
        UPDATE public.bons_commande bc
        SET organization_id = f.organization_id
        FROM public.fournisseurs f
        WHERE bc.fournisseur_id = f.id AND bc.organization_id IS NULL;

        -- Fallback default for any remaining nulls
        UPDATE public.bons_commande
        SET organization_id = '00000000-0000-0000-0000-000000000001'
        WHERE organization_id IS NULL;

        CREATE INDEX IF NOT EXISTS idx_bons_commande_organization_id ON public.bons_commande(organization_id);
    END IF;
END $$;
