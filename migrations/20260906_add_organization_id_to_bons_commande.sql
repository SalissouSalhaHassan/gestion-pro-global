-- ==============================================================================
-- MIGRATION: 20260906_add_organization_id_to_bons_commande.sql
-- DESCRIPTION: Add organization_id multi-tenancy support for Purchase Orders
-- SYSTEM: Gestion Pro Global (Enterprise Edition)
-- ==============================================================================

-- 1. Add organization_id column to bons_commande if not already present
ALTER TABLE IF EXISTS public.bons_commande 
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- 2. Add organization_id column to bon_commande_items if not already present
ALTER TABLE IF EXISTS public.bon_commande_items 
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- 3. Create indexes for high-speed multi-tenant queries
CREATE INDEX IF NOT EXISTS idx_bons_commande_org ON public.bons_commande(organization_id);
CREATE INDEX IF NOT EXISTS idx_bon_commande_items_org ON public.bon_commande_items(organization_id);

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
