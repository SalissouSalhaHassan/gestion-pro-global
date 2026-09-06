-- ==============================================================================
-- Migration: Add invoice_visibility_policy to informations_entreprise
-- Date: 2026-09-06
-- ==============================================================================

-- 1. Ensure column exists on informations_entreprise
ALTER TABLE public.informations_entreprise
  ADD COLUMN IF NOT EXISTS invoice_visibility_policy TEXT DEFAULT 'shared';

-- 2. Comment describing the available modes
COMMENT ON COLUMN public.informations_entreprise.invoice_visibility_policy 
  IS 'Invoice visibility policy for cashiers/sellers: shared (all org), personal (own invoices only - Option A), depot (assigned depot only - Option B)';
