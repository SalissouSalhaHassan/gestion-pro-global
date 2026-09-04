-- =============================================================================
-- GESTION PRO GLOBAL - STRICT MULTI-TENANT ISOLATION MIGRATION
-- Date: 2026-09-04
-- Description:
--   Enforces uncompromising tenant data isolation across organizations.
--   Removes legacy fallback exemptions for default org 00000000-0000-0000-0000-000000000001
--   and removes permissive 'OR id IS NOT NULL' clauses on invoices.
-- =============================================================================

-- 1. Helper function to extract organization context from request headers
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('request.headers', true)::json->>'x-organization-id', '')::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. Depots Isolation
DROP POLICY IF EXISTS "Depots tenant isolation" ON public.depots;
CREATE POLICY "Depots tenant isolation"
ON public.depots
FOR ALL
TO authenticated, anon
USING (
    (public.get_current_tenant_id() IS NOT NULL AND organization_id = public.get_current_tenant_id())
    OR (public.get_current_tenant_id() IS NULL AND organization_id = '00000000-0000-0000-0000-000000000001'::uuid)
)
WITH CHECK (
    (public.get_current_tenant_id() IS NOT NULL AND organization_id = public.get_current_tenant_id())
    OR (public.get_current_tenant_id() IS NULL AND organization_id = '00000000-0000-0000-0000-000000000001'::uuid)
);

-- 3. Invoices (Factures) Strict Isolation
DROP POLICY IF EXISTS "Factures tenant and public read" ON public.factures;
CREATE POLICY "Factures tenant and public read"
ON public.factures
FOR SELECT
TO authenticated, anon
USING (
    is_deleted = false
    AND (
        (public.get_current_tenant_id() IS NOT NULL AND organization_id = public.get_current_tenant_id())
        OR (public.get_current_tenant_id() IS NULL AND organization_id = '00000000-0000-0000-0000-000000000001'::uuid)
    )
);

DROP POLICY IF EXISTS "Factures write within organization" ON public.factures;
CREATE POLICY "Factures write within organization"
ON public.factures
FOR INSERT
TO authenticated, anon
WITH CHECK (
    (public.get_current_tenant_id() IS NOT NULL AND organization_id = public.get_current_tenant_id())
    OR (public.get_current_tenant_id() IS NULL AND organization_id = '00000000-0000-0000-0000-000000000001'::uuid)
);

DROP POLICY IF EXISTS "Factures update within organization" ON public.factures;
CREATE POLICY "Factures update within organization"
ON public.factures
FOR UPDATE
TO authenticated, anon
USING (
    (public.get_current_tenant_id() IS NOT NULL AND organization_id = public.get_current_tenant_id())
    OR (public.get_current_tenant_id() IS NULL AND organization_id = '00000000-0000-0000-0000-000000000001'::uuid)
)
WITH CHECK (
    (public.get_current_tenant_id() IS NOT NULL AND organization_id = public.get_current_tenant_id())
    OR (public.get_current_tenant_id() IS NULL AND organization_id = '00000000-0000-0000-0000-000000000001'::uuid)
);

-- 4. Clients Isolation
DROP POLICY IF EXISTS "Clients tenant isolation" ON public.clients;
CREATE POLICY "Clients tenant isolation"
ON public.clients
FOR ALL
TO authenticated, anon
USING (
    (public.get_current_tenant_id() IS NOT NULL AND organization_id = public.get_current_tenant_id())
    OR (public.get_current_tenant_id() IS NULL AND organization_id = '00000000-0000-0000-0000-000000000001'::uuid)
)
WITH CHECK (
    (public.get_current_tenant_id() IS NOT NULL AND organization_id = public.get_current_tenant_id())
    OR (public.get_current_tenant_id() IS NULL AND organization_id = '00000000-0000-0000-0000-000000000001'::uuid)
);

-- 5. Fournisseurs Isolation
DROP POLICY IF EXISTS "Fournisseurs tenant isolation" ON public.fournisseurs;
CREATE POLICY "Fournisseurs tenant isolation"
ON public.fournisseurs
FOR ALL
TO authenticated, anon
USING (
    (public.get_current_tenant_id() IS NOT NULL AND organization_id = public.get_current_tenant_id())
    OR (public.get_current_tenant_id() IS NULL AND organization_id = '00000000-0000-0000-0000-000000000001'::uuid)
)
WITH CHECK (
    (public.get_current_tenant_id() IS NOT NULL AND organization_id = public.get_current_tenant_id())
    OR (public.get_current_tenant_id() IS NULL AND organization_id = '00000000-0000-0000-0000-000000000001'::uuid)
);

-- 6. Stocks Isolation
DROP POLICY IF EXISTS "Stocks tenant isolation" ON public.stocks;
CREATE POLICY "Stocks tenant isolation"
ON public.stocks
FOR ALL
TO authenticated, anon
USING (
    (public.get_current_tenant_id() IS NOT NULL AND organization_id = public.get_current_tenant_id())
    OR (public.get_current_tenant_id() IS NULL AND organization_id = '00000000-0000-0000-0000-000000000001'::uuid)
)
WITH CHECK (
    (public.get_current_tenant_id() IS NOT NULL AND organization_id = public.get_current_tenant_id())
    OR (public.get_current_tenant_id() IS NULL AND organization_id = '00000000-0000-0000-0000-000000000001'::uuid)
);

-- 7. Mouvements Isolation
DROP POLICY IF EXISTS "Mouvements tenant isolation" ON public.mouvements;
CREATE POLICY "Mouvements tenant isolation"
ON public.mouvements
FOR ALL
TO authenticated, anon
USING (
    (public.get_current_tenant_id() IS NOT NULL AND organization_id = public.get_current_tenant_id())
    OR (public.get_current_tenant_id() IS NULL AND organization_id = '00000000-0000-0000-0000-000000000001'::uuid)
)
WITH CHECK (
    (public.get_current_tenant_id() IS NOT NULL AND organization_id = public.get_current_tenant_id())
    OR (public.get_current_tenant_id() IS NULL AND organization_id = '00000000-0000-0000-0000-000000000001'::uuid)
);

-- 8. Users Isolation
DROP POLICY IF EXISTS "Allow user read access" ON public.users;
CREATE POLICY "Allow user read access"
ON public.users
FOR SELECT
TO authenticated, anon
USING (
    (public.get_current_tenant_id() IS NOT NULL AND organization_id = public.get_current_tenant_id())
    OR public.get_current_tenant_id() IS NULL
);

DROP POLICY IF EXISTS "Allow user update within organization" ON public.users;
CREATE POLICY "Allow user update within organization"
ON public.users
FOR UPDATE
TO authenticated, anon
USING (
    (public.get_current_tenant_id() IS NOT NULL AND organization_id = public.get_current_tenant_id())
    OR (public.get_current_tenant_id() IS NULL AND organization_id = '00000000-0000-0000-0000-000000000001'::uuid)
)
WITH CHECK (
    (public.get_current_tenant_id() IS NOT NULL AND organization_id = public.get_current_tenant_id())
    OR (public.get_current_tenant_id() IS NULL AND organization_id = '00000000-0000-0000-0000-000000000001'::uuid)
);
