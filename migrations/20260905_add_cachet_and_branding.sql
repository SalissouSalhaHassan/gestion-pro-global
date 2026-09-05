-- ==============================================================================
-- Migration: Add Cachet and Branding Customization to informations_entreprise
-- Date: 2026-09-05
-- ==============================================================================

-- 1. Ensure columns exist on informations_entreprise
ALTER TABLE public.informations_entreprise
  ADD COLUMN IF NOT EXISTS cachet_url TEXT,
  ADD COLUMN IF NOT EXISTS brand_color TEXT DEFAULT '#4f46e5',
  ADD COLUMN IF NOT EXISTS slogan TEXT,
  ADD COLUMN IF NOT EXISTS show_stamp BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_qr_code BOOLEAN DEFAULT true;

-- 2. Create index on organization_id for fast company profile retrieval
CREATE INDEX IF NOT EXISTS idx_informations_entreprise_org 
  ON public.informations_entreprise(organization_id);

-- 3. Comment describing the fields
COMMENT ON COLUMN public.informations_entreprise.cachet_url IS 'Public URL or base64 data of company official stamp / cachet image';
COMMENT ON COLUMN public.informations_entreprise.brand_color IS 'Hex color code for invoice branding';
COMMENT ON COLUMN public.informations_entreprise.show_stamp IS 'Toggle whether official stamp is displayed on documents';
