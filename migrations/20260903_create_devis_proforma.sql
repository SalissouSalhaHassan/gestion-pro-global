-- ==============================================================================
-- MIGRATION: 20260903_create_devis_proforma.sql
-- DESCRIPTION: Quotations & Proforma Invoices (Devis & Factures Proforma)
-- AUTHOR: Lead Software Architect & Technical Supervisor
-- SYSTEM: Gestion Pro Global (Enterprise Edition)
-- ==============================================================================

-- 1. Create devis table
CREATE TABLE IF NOT EXISTS public.devis (
    id SERIAL PRIMARY KEY,
    numero_devis VARCHAR(50) NOT NULL UNIQUE,
    client_id INTEGER REFERENCES public.clients(id) ON DELETE SET NULL,
    client_nom VARCHAR(255) NOT NULL,
    client_tel VARCHAR(50),
    client_adresse TEXT,
    date_devis DATE NOT NULL DEFAULT CURRENT_DATE,
    date_validite DATE,
    total_ht NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_tva NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_ttc NUMERIC(15, 2) NOT NULL DEFAULT 0,
    statut VARCHAR(50) NOT NULL DEFAULT 'En attente', -- 'En attente', 'Accepté', 'Converti', 'Refusé', 'Expiré'
    facture_id INTEGER REFERENCES public.factures(id) ON DELETE SET NULL,
    vendeur VARCHAR(100),
    notes TEXT,
    conditions_reglement TEXT,
    organization_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create devis_items table
CREATE TABLE IF NOT EXISTS public.devis_items (
    id SERIAL PRIMARY KEY,
    devis_id INTEGER NOT NULL REFERENCES public.devis(id) ON DELETE CASCADE,
    article_id INTEGER REFERENCES public.articles(id) ON DELETE SET NULL,
    reference VARCHAR(100),
    description VARCHAR(255) NOT NULL,
    qte NUMERIC(12, 3) NOT NULL DEFAULT 1,
    pu_ht NUMERIC(15, 2) NOT NULL DEFAULT 0,
    remise_pourcentage NUMERIC(5, 2) DEFAULT 0,
    taux_tva NUMERIC(5, 2) DEFAULT 0,
    total_ligne_ht NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_ligne_ttc NUMERIC(15, 2) NOT NULL DEFAULT 0
);

-- 3. Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_devis_date 
  ON public.devis (date_devis DESC);

CREATE INDEX IF NOT EXISTS idx_devis_client 
  ON public.devis (client_id, date_devis DESC);

CREATE INDEX IF NOT EXISTS idx_devis_statut 
  ON public.devis (statut);

CREATE INDEX IF NOT EXISTS idx_devis_items_devis 
  ON public.devis_items (devis_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.devis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devis_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for authenticated users on devis" 
  ON public.devis FOR SELECT USING (true);

CREATE POLICY "Enable all for authenticated users on devis" 
  ON public.devis FOR ALL USING (true);

CREATE POLICY "Enable read for authenticated users on devis_items" 
  ON public.devis_items FOR SELECT USING (true);

CREATE POLICY "Enable all for authenticated users on devis_items" 
  ON public.devis_items FOR ALL USING (true);
