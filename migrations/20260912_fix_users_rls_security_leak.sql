-- =============================================================================
-- GESTION PRO GLOBAL - FIX USERS TABLE RLS SECURITY LEAK
-- Date: 2026-09-12
-- Description:
--   Closes critical security vulnerability where public.users allowed unrestricted
--   SELECT to anon when get_current_tenant_id() was NULL.
-- =============================================================================

-- 1. Revoke public/anon unrestricted access to users table
REVOKE ALL ON public.users FROM anon;
GRANT SELECT ON public.users TO authenticated;

-- 2. Drop the insecure policy
DROP POLICY IF EXISTS "Allow user read access" ON public.users;

-- 3. Create strict tenant-scoped read policy
CREATE POLICY "Allow user read access"
ON public.users
FOR SELECT
TO authenticated
USING (
    public.get_current_tenant_id() IS NOT NULL 
    AND organization_id = public.get_current_tenant_id()
);

-- 4. Ensure updates can only occur within user's own organization
DROP POLICY IF EXISTS "Allow user update within organization" ON public.users;
CREATE POLICY "Allow user update within organization"
ON public.users
FOR UPDATE
TO authenticated
USING (
    public.get_current_tenant_id() IS NOT NULL 
    AND organization_id = public.get_current_tenant_id()
)
WITH CHECK (
    public.get_current_tenant_id() IS NOT NULL 
    AND organization_id = public.get_current_tenant_id()
);
