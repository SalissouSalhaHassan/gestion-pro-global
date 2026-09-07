-- ==============================================================================
-- MIGRATION: gestion_ciment & ciment_paiements (Gestion des Chargements de Ciment)
-- ==============================================================================

-- 1. Create Ciment Shipments Table
CREATE TABLE IF NOT EXISTS public.gestion_ciment (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_tel TEXT NOT NULL,
    camion_no TEXT NOT NULL,
    transporteur TEXT,
    type_ciment TEXT,
    destination TEXT,
    chauffeur TEXT,
    chauffeur_tel TEXT,
    bons TEXT,
    arrivage TEXT,
    tonnage NUMERIC NOT NULL DEFAULT 0,
    pu NUMERIC NOT NULL DEFAULT 0,
    frais_ciment NUMERIC DEFAULT 0,
    frais_transport NUMERIC DEFAULT 0,
    tva_pourcentage NUMERIC DEFAULT 19,
    bic_pourcentage NUMERIC DEFAULT 2,
    total NUMERIC NOT NULL DEFAULT 0,
    montant_paye NUMERIC DEFAULT 0,
    statut_paiement TEXT DEFAULT 'Non Payأ©',
    utilisateur TEXT,
    user_id UUID,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure organization_id column exists if table was partially created
ALTER TABLE public.gestion_ciment ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 2. Create Ciment Payments Table
CREATE TABLE IF NOT EXISTS public.ciment_paiements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ciment_id UUID NOT NULL REFERENCES public.gestion_ciment(id) ON DELETE CASCADE,
    montant NUMERIC NOT NULL DEFAULT 0,
    moyen_paiement TEXT NOT NULL,
    reference TEXT,
    date_paiement TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    utilisateur TEXT,
    user_id UUID,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure organization_id column exists if table was partially created
ALTER TABLE public.ciment_paiements ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 3. Indexes for High Performance
CREATE INDEX IF NOT EXISTS idx_gestion_ciment_org ON public.gestion_ciment(organization_id);
CREATE INDEX IF NOT EXISTS idx_gestion_ciment_camion ON public.gestion_ciment(camion_no);
CREATE INDEX IF NOT EXISTS idx_gestion_ciment_client ON public.gestion_ciment(client_tel);
CREATE INDEX IF NOT EXISTS idx_gestion_ciment_created ON public.gestion_ciment(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ciment_paiements_ciment_id ON public.ciment_paiements(ciment_id);
CREATE INDEX IF NOT EXISTS idx_ciment_paiements_org ON public.ciment_paiements(organization_id);

-- 4. Enable Row Level Security (RLS) & Policies
ALTER TABLE public.gestion_ciment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ciment_paiements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read for all on gestion_ciment" ON public.gestion_ciment;
CREATE POLICY "Enable read for all on gestion_ciment" ON public.gestion_ciment FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable write for all on gestion_ciment" ON public.gestion_ciment;
CREATE POLICY "Enable write for all on gestion_ciment" ON public.gestion_ciment FOR ALL USING (true);

DROP POLICY IF EXISTS "Enable read for all on ciment_paiements" ON public.ciment_paiements;
CREATE POLICY "Enable read for all on ciment_paiements" ON public.ciment_paiements FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable write for all on ciment_paiements" ON public.ciment_paiements;
CREATE POLICY "Enable write for all on ciment_paiements" ON public.ciment_paiements FOR ALL USING (true);

-- 5. Force Schema Cache Reload in PostgREST
NOTIFY pgrst, 'reload schema';

