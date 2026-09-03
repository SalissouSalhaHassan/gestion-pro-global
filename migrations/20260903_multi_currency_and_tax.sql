-- ==============================================================================
-- MIGRATION: 20260903_multi_currency_and_tax.sql
-- DESCRIPTION: Multi-Currency (FCFA, NGN, USD, EUR) & TVA Fiscal Configuration
-- AUTHOR: Lead Software Architect & Technical Supervisor
-- SYSTEM: Gestion Pro Global (Enterprise Edition)
-- ==============================================================================

-- 1. Create devises table
CREATE TABLE IF NOT EXISTS public.devises (
    code VARCHAR(10) PRIMARY KEY, -- 'FCFA', 'NGN', 'USD', 'EUR'
    nom VARCHAR(100) NOT NULL,
    symbole VARCHAR(10) NOT NULL,
    taux_vers_cfa NUMERIC(15, 6) NOT NULL DEFAULT 1.0, -- Multiplier to convert foreign currency into FCFA
    is_base BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed Default Currencies & Real Market Exchange Rates
INSERT INTO public.devises (code, nom, symbole, taux_vers_cfa, is_base)
VALUES 
  ('FCFA', 'Franc CFA (BCEAO/UEMOA)', 'FCFA', 1.0, true),
  ('NGN', 'Naira Nigérian', '₦', 0.40, false),          -- 1 NGN ≈ 0.40 FCFA (or 1 FCFA ≈ 2.50 NGN)
  ('USD', 'Dollar Américain', '$', 615.0, false),       -- 1 USD ≈ 615 FCFA
  ('EUR', 'Euro', '€', 655.957, false)                  -- 1 EUR = 655.957 FCFA (Fixed parity)
ON CONFLICT (code) DO UPDATE 
SET taux_vers_cfa = EXCLUDED.taux_vers_cfa,
    updated_at = timezone('utc'::text, now());

-- 2. Create parametres_fiscaux table (Tax & TVA Settings)
CREATE TABLE IF NOT EXISTS public.parametres_fiscaux (
    id SERIAL PRIMARY KEY,
    taux_tva_defaut NUMERIC(5, 2) NOT NULL DEFAULT 19.00, -- 19% TVA UEMOA / Niger
    tva_activee BOOLEAN NOT NULL DEFAULT true,
    nif VARCHAR(100) DEFAULT '',
    rccm VARCHAR(100) DEFAULT '',
    centre_impots VARCHAR(100) DEFAULT 'DGI Niamey',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

INSERT INTO public.parametres_fiscaux (id, taux_tva_defaut, tva_activee)
VALUES (1, 19.00, true)
ON CONFLICT (id) DO NOTHING;

-- 3. Row Level Security
ALTER TABLE public.devises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parametres_fiscaux ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for all authenticated on devises"
  ON public.devises FOR SELECT USING (true);

CREATE POLICY "Enable write for all authenticated on devises"
  ON public.devises FOR ALL USING (true);

CREATE POLICY "Enable read for all authenticated on parametres_fiscaux"
  ON public.parametres_fiscaux FOR SELECT USING (true);

CREATE POLICY "Enable write for all authenticated on parametres_fiscaux"
  ON public.parametres_fiscaux FOR ALL USING (true);
