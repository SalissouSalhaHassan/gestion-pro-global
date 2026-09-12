-- =============================================================================
-- GESTION PRO GLOBAL - FIX USERS TABLE RLS SECURITY LEAK (SELF-CONTAINED)
-- Date: 2026-09-12
-- Description:
--   1. Ensures helper function public.get_current_tenant_id() exists.
--   2. Revokes public/anon unrestricted access to users table.
--   3. Closes security leak where users table was accessible to anon.
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

-- 2. Revoke public/anon unrestricted access to users table
REVOKE ALL ON public.users FROM anon;
GRANT SELECT ON public.users TO authenticated;

-- 3. Drop the insecure policy if it exists
DROP POLICY IF EXISTS "Allow user read access" ON public.users;

-- 4. Create strict tenant-scoped read policy
CREATE POLICY "Allow user read access"
ON public.users
FOR SELECT
TO authenticated
USING (
    public.get_current_tenant_id() IS NOT NULL 
    AND organization_id = public.get_current_tenant_id()
);

-- 5. Ensure updates can only occur within user's own organization
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
