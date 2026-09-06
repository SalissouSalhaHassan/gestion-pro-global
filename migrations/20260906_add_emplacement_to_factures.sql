-- ==============================================================================
-- Migration: Add emplacement to factures and backfill from users
-- Date: 2026-09-06
-- ==============================================================================

-- 1. Ensure emplacement column exists on factures
ALTER TABLE public.factures 
  ADD COLUMN IF NOT EXISTS emplacement TEXT;

-- 2. Backfill existing invoices with the creator's assigned emplacement
UPDATE public.factures f
SET emplacement = u.emplacement
FROM public.users u
WHERE f.vendeur = u.utilisateur 
  AND (f.emplacement IS NULL OR f.emplacement = '');

-- 3. Add index on emplacement for fast depot-level queries
CREATE INDEX IF NOT EXISTS idx_factures_emplacement ON public.factures(emplacement);

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
