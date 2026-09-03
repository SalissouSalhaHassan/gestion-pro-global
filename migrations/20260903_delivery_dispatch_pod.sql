-- ==============================================================================
-- MIGRATION: 20260903_delivery_dispatch_pod.sql
-- DESCRIPTION: Delivery Dispatching, Driver Runs & Proof of Delivery (POD)
-- AUTHOR: Lead Software Architect & Technical Supervisor
-- SYSTEM: Gestion Pro Global (Enterprise Logistics Edition)
-- ==============================================================================

-- 1. Table: tournees_livraison (Delivery Runs / Manifests)
CREATE TABLE IF NOT EXISTS public.tournees_livraison (
    id SERIAL PRIMARY KEY,
    reference VARCHAR(50) UNIQUE NOT NULL,
    chauffeur_nom VARCHAR(100) NOT NULL,
    chauffeur_tel VARCHAR(50),
    vehicule_matricule VARCHAR(50),
    statut VARCHAR(30) NOT NULL DEFAULT 'EN_PREPARATION', -- 'EN_PREPARATION', 'EN_ROUTE', 'TERMINEE', 'ANNULEE'
    zone_livraison VARCHAR(150),
    total_colis INTEGER NOT NULL DEFAULT 0,
    total_montant_a_encaisser NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_encaisse NUMERIC(15, 2) NOT NULL DEFAULT 0,
    date_depart TIMESTAMP WITH TIME ZONE,
    date_retour TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Table: colis_livraison (Delivery Run Items / Packages)
CREATE TABLE IF NOT EXISTS public.colis_livraison (
    id SERIAL PRIMARY KEY,
    tournee_id INTEGER NOT NULL REFERENCES public.tournees_livraison(id) ON DELETE CASCADE,
    facture_id INTEGER REFERENCES public.factures(id) ON DELETE SET NULL,
    client_nom VARCHAR(150) NOT NULL,
    client_tel VARCHAR(50),
    adresse_livraison TEXT NOT NULL,
    montant_a_encaisser NUMERIC(15, 2) NOT NULL DEFAULT 0,
    statut_livraison VARCHAR(30) NOT NULL DEFAULT 'EN_ATTENTE', -- 'EN_ATTENTE', 'LIVRE', 'ECHEC'
    heure_livraison TIMESTAMP WITH TIME ZONE,
    nom_receptionnaire VARCHAR(100),
    commentaire TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Composite Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tournees_reference ON public.tournees_livraison (reference);
CREATE INDEX IF NOT EXISTS idx_tournees_statut ON public.tournees_livraison (statut);
CREATE INDEX IF NOT EXISTS idx_tournees_created_at ON public.tournees_livraison (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_colis_tournee_id ON public.colis_livraison (tournee_id);
CREATE INDEX IF NOT EXISTS idx_colis_facture_id ON public.colis_livraison (facture_id);

-- 4. Row Level Security
ALTER TABLE public.tournees_livraison ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colis_livraison ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for all authenticated on tournees_livraison"
  ON public.tournees_livraison FOR SELECT USING (true);

CREATE POLICY "Enable write for all authenticated on tournees_livraison"
  ON public.tournees_livraison FOR ALL USING (true);

CREATE POLICY "Enable read for all authenticated on colis_livraison"
  ON public.colis_livraison FOR SELECT USING (true);

CREATE POLICY "Enable write for all authenticated on colis_livraison"
  ON public.colis_livraison FOR ALL USING (true);
