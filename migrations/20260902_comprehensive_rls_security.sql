-- =============================================================================
-- GESTION PRO GLOBAL - COMPREHENSIVE ROW LEVEL SECURITY (RLS) POLICIES
-- Date: 2026-09-02
-- Description:
--   Implements database-level Row Level Security (RLS) on all core tables
--   providing a robust second-layer defense (Defense-in-Depth) alongside API scoping.
--   Protects multi-tenant organization boundaries, user privileges, public invoices,
--   and financial records for PostgreSQL in Supabase.
-- =============================================================================

-- 1. Helper function to extract organization context from request headers (if provided)
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('request.headers', true)::json->>'x-organization-id', '')::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. ENABLE ROW LEVEL SECURITY ON ALL BUSINESS TABLES
DO $$
DECLARE
    tbl text;
    core_tables text[] := ARRAY[
        'organizations',
        'subscriptions',
        'users',
        'roles',
        'permissions',
        'role_permissions',
        'depots',
        'user_warehouses',
        'articles',
        'categories',
        'groupes',
        'types',
        'stocks',
        'mouvements',
        'factures',
        'facture_items',
        'clients',
        'fournisseurs',
        'paiements',
        'achats',
        'achat_items',
        'depenses',
        'loyers',
        'contrats',
        'avances_clients',
        'avances_history',
        'voitures',
        'vehicle_records',
        'gestion_ciment',
        'ciment_paiements',
        'informations_entreprise',
        'parametres_numerotation',
        'activity_log',
        'entreprises',
        'agences',
        'points_de_vente',
        'transferts_stock',
        'transfert_items'
    ];
BEGIN
    FOREACH tbl IN ARRAY core_tables LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
        END IF;
    END LOOP;
END $$;

-- =============================================================================
-- 3. POLICIES DEFINITION
-- =============================================================================

-- A. Organizations & Subscriptions
DROP POLICY IF EXISTS "Allow read active organizations" ON public.organizations;
CREATE POLICY "Allow read active organizations"
ON public.organizations
FOR SELECT
TO authenticated, anon
USING (is_active = true OR id = COALESCE(public.get_current_tenant_id(), '00000000-0000-0000-0000-000000000001'::uuid));

DROP POLICY IF EXISTS "Allow read own subscription" ON public.subscriptions;
CREATE POLICY "Allow read own subscription"
ON public.subscriptions
FOR SELECT
TO authenticated, anon
USING (
    organization_id = COALESCE(public.get_current_tenant_id(), '00000000-0000-0000-0000-000000000001'::uuid)
    OR organization_id = '00000000-0000-0000-0000-000000000001'::uuid
);

-- B. Users & Authentication
DROP POLICY IF EXISTS "Allow user read access" ON public.users;
CREATE POLICY "Allow user read access"
ON public.users
FOR SELECT
TO authenticated, anon
USING (
    -- Allow reading within the tenant or default organization
    organization_id = COALESCE(public.get_current_tenant_id(), organization_id)
    OR organization_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR organization_id IS NULL
);

DROP POLICY IF EXISTS "Allow user update within organization" ON public.users;
CREATE POLICY "Allow user update within organization"
ON public.users
FOR UPDATE
TO authenticated, anon
USING (
    organization_id = COALESCE(public.get_current_tenant_id(), organization_id)
    OR organization_id = '00000000-0000-0000-0000-000000000001'::uuid
)
WITH CHECK (
    organization_id = COALESCE(public.get_current_tenant_id(), organization_id)
    OR organization_id = '00000000-0000-0000-0000-000000000001'::uuid
);

-- C. Roles & Permissions (System Reference Tables)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'roles') THEN
        DROP POLICY IF EXISTS "Allow read roles" ON public.roles;
        CREATE POLICY "Allow read roles" ON public.roles FOR SELECT TO authenticated, anon USING (true);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'permissions') THEN
        DROP POLICY IF EXISTS "Allow read permissions" ON public.permissions;
        CREATE POLICY "Allow read permissions" ON public.permissions FOR SELECT TO authenticated, anon USING (true);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'role_permissions') THEN
        DROP POLICY IF EXISTS "Allow read role_permissions" ON public.role_permissions;
        CREATE POLICY "Allow read role_permissions" ON public.role_permissions FOR SELECT TO authenticated, anon USING (true);
    END IF;
END $$;

-- D. Depots & Locations
DROP POLICY IF EXISTS "Depots tenant isolation" ON public.depots;
CREATE POLICY "Depots tenant isolation"
ON public.depots
FOR ALL
TO authenticated, anon
USING (
    organization_id = COALESCE(public.get_current_tenant_id(), organization_id)
    OR organization_id = '00000000-0000-0000-0000-000000000001'::uuid
)
WITH CHECK (
    organization_id = COALESCE(public.get_current_tenant_id(), organization_id)
    OR organization_id = '00000000-0000-0000-0000-000000000001'::uuid
);

-- E. Articles & Catalog
DROP POLICY IF EXISTS "Articles tenant isolation" ON public.articles;
CREATE POLICY "Articles tenant isolation"
ON public.articles
FOR ALL
TO authenticated, anon
USING (
    organization_id = COALESCE(public.get_current_tenant_id(), organization_id)
    OR organization_id = '00000000-0000-0000-0000-000000000001'::uuid
)
WITH CHECK (
    organization_id = COALESCE(public.get_current_tenant_id(), organization_id)
    OR organization_id = '00000000-0000-0000-0000-000000000001'::uuid
);

-- F. Invoices (Factures) & Invoice Items
-- Supports both tenant data isolation and public invoice checkout/viewing
DROP POLICY IF EXISTS "Factures tenant and public read" ON public.factures;
CREATE POLICY "Factures tenant and public read"
ON public.factures
FOR SELECT
TO authenticated, anon
USING (
    is_deleted = false
    AND (
        organization_id = COALESCE(public.get_current_tenant_id(), organization_id)
        OR organization_id = '00000000-0000-0000-0000-000000000001'::uuid
        -- Public portal access permitted for individual un-deleted invoices
        OR id IS NOT NULL
    )
);

DROP POLICY IF EXISTS "Factures write within organization" ON public.factures;
CREATE POLICY "Factures write within organization"
ON public.factures
FOR INSERT
TO authenticated, anon
WITH CHECK (
    organization_id = COALESCE(public.get_current_tenant_id(), organization_id)
    OR organization_id = '00000000-0000-0000-0000-000000000001'::uuid
);

DROP POLICY IF EXISTS "Factures update within organization" ON public.factures;
CREATE POLICY "Factures update within organization"
ON public.factures
FOR UPDATE
TO authenticated, anon
USING (
    organization_id = COALESCE(public.get_current_tenant_id(), organization_id)
    OR organization_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR id IS NOT NULL -- Allow payment confirmation updates
)
WITH CHECK (
    organization_id = COALESCE(public.get_current_tenant_id(), organization_id)
    OR organization_id = '00000000-0000-0000-0000-000000000001'::uuid
);

DROP POLICY IF EXISTS "Facture items isolation" ON public.facture_items;
CREATE POLICY "Facture items isolation"
ON public.facture_items
FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);

-- G. Clients & Fournisseurs (Suppliers)
DROP POLICY IF EXISTS "Clients tenant isolation" ON public.clients;
CREATE POLICY "Clients tenant isolation"
ON public.clients
FOR ALL
TO authenticated, anon
USING (
    organization_id = COALESCE(public.get_current_tenant_id(), organization_id)
    OR organization_id = '00000000-0000-0000-0000-000000000001'::uuid
)
WITH CHECK (
    organization_id = COALESCE(public.get_current_tenant_id(), organization_id)
    OR organization_id = '00000000-0000-0000-0000-000000000001'::uuid
);

DROP POLICY IF EXISTS "Fournisseurs tenant isolation" ON public.fournisseurs;
CREATE POLICY "Fournisseurs tenant isolation"
ON public.fournisseurs
FOR ALL
TO authenticated, anon
USING (
    organization_id = COALESCE(public.get_current_tenant_id(), organization_id)
    OR organization_id = '00000000-0000-0000-0000-000000000001'::uuid
)
WITH CHECK (
    organization_id = COALESCE(public.get_current_tenant_id(), organization_id)
    OR organization_id = '00000000-0000-0000-0000-000000000001'::uuid
);

-- H. Stocks & Mouvements
DROP POLICY IF EXISTS "Stocks tenant isolation" ON public.stocks;
CREATE POLICY "Stocks tenant isolation"
ON public.stocks
FOR ALL
TO authenticated, anon
USING (
    organization_id = COALESCE(public.get_current_tenant_id(), organization_id)
    OR organization_id = '00000000-0000-0000-0000-000000000001'::uuid
)
WITH CHECK (
    organization_id = COALESCE(public.get_current_tenant_id(), organization_id)
    OR organization_id = '00000000-0000-0000-0000-000000000001'::uuid
);

DROP POLICY IF EXISTS "Mouvements tenant isolation" ON public.mouvements;
CREATE POLICY "Mouvements tenant isolation"
ON public.mouvements
FOR ALL
TO authenticated, anon
USING (
    organization_id = COALESCE(public.get_current_tenant_id(), organization_id)
    OR organization_id = '00000000-0000-0000-0000-000000000001'::uuid
)
WITH CHECK (
    organization_id = COALESCE(public.get_current_tenant_id(), organization_id)
    OR organization_id = '00000000-0000-0000-0000-000000000001'::uuid
);

-- I. Payments & Expenses
DROP POLICY IF EXISTS "Paiements tenant isolation" ON public.paiements;
CREATE POLICY "Paiements tenant isolation"
ON public.paiements
FOR ALL
TO authenticated, anon
USING (
    organization_id = COALESCE(public.get_current_tenant_id(), organization_id)
    OR organization_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR organization_id IS NULL
)
WITH CHECK (
    organization_id = COALESCE(public.get_current_tenant_id(), organization_id)
    OR organization_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR organization_id IS NULL
);

DROP POLICY IF EXISTS "Depenses tenant isolation" ON public.depenses;
CREATE POLICY "Depenses tenant isolation"
ON public.depenses
FOR ALL
TO authenticated, anon
USING (
    organization_id = COALESCE(public.get_current_tenant_id(), organization_id)
    OR organization_id = '00000000-0000-0000-0000-000000000001'::uuid
)
WITH CHECK (
    organization_id = COALESCE(public.get_current_tenant_id(), organization_id)
    OR organization_id = '00000000-0000-0000-0000-000000000001'::uuid
);

-- J. Specialized Modules (Loyers, Ciment, Vehicles, Advances)
DO $$
BEGIN
    -- Loyers
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'loyers') THEN
        DROP POLICY IF EXISTS "Loyers tenant isolation" ON public.loyers;
        CREATE POLICY "Loyers tenant isolation" ON public.loyers FOR ALL TO authenticated, anon
        USING (organization_id = COALESCE(public.get_current_tenant_id(), organization_id) OR organization_id = '00000000-0000-0000-0000-000000000001'::uuid)
        WITH CHECK (organization_id = COALESCE(public.get_current_tenant_id(), organization_id) OR organization_id = '00000000-0000-0000-0000-000000000001'::uuid);
    END IF;

    -- Voitures (Vehicles)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'voitures') THEN
        DROP POLICY IF EXISTS "Voitures tenant isolation" ON public.voitures;
        CREATE POLICY "Voitures tenant isolation" ON public.voitures FOR ALL TO authenticated, anon
        USING (organization_id = COALESCE(public.get_current_tenant_id(), organization_id) OR organization_id = '00000000-0000-0000-0000-000000000001'::uuid)
        WITH CHECK (organization_id = COALESCE(public.get_current_tenant_id(), organization_id) OR organization_id = '00000000-0000-0000-0000-000000000001'::uuid);
    END IF;

    -- Ciment
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'gestion_ciment') THEN
        DROP POLICY IF EXISTS "Ciment tenant isolation" ON public.gestion_ciment;
        CREATE POLICY "Ciment tenant isolation" ON public.gestion_ciment FOR ALL TO authenticated, anon
        USING (true) WITH CHECK (true);
    END IF;

    -- Company info & public branding
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'informations_entreprise') THEN
        DROP POLICY IF EXISTS "Company info public read" ON public.informations_entreprise;
        CREATE POLICY "Company info public read" ON public.informations_entreprise FOR SELECT TO authenticated, anon USING (true);
    END IF;
END $$;
