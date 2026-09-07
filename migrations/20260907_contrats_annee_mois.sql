-- ==============================================================================
-- MIGRATION: Add annee_debut and mois_debut to contrats table
-- ==============================================================================

-- 1. Add annee_debut & mois_debut to contrats if missing
ALTER TABLE public.contrats ADD COLUMN IF NOT EXISTS annee_debut INTEGER DEFAULT 2026;
ALTER TABLE public.contrats ADD COLUMN IF NOT EXISTS mois_debut INTEGER DEFAULT 1;
ALTER TABLE public.contrats ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 2. Ensure contrat_paiements has organization_id
ALTER TABLE public.contrat_paiements ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 3. Create index for performance
CREATE INDEX IF NOT EXISTS idx_contrats_annee_mois ON public.contrats(annee_debut, mois_debut);
CREATE INDEX IF NOT EXISTS idx_contrats_org ON public.contrats(organization_id);
CREATE INDEX IF NOT EXISTS idx_contrat_paiements_org ON public.contrat_paiements(organization_id);

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
