-- ==============================================================================
-- MIGRATION: 20260903_create_bons_commande.sql
-- DESCRIPTION: Purchase Orders (Bons de Commande) & Automated Procurement System
-- AUTHOR: Lead Software Architect & Technical Supervisor
-- SYSTEM: Gestion Pro Global (Enterprise Edition)
-- ==============================================================================

-- 1. Create bons_commande header table
CREATE TABLE IF NOT EXISTS public.bons_commande (
    id SERIAL PRIMARY KEY,
    numero_bc VARCHAR(50) UNIQUE NOT NULL,
    date_commande DATE NOT NULL DEFAULT CURRENT_DATE,
    date_livraison_prevue DATE,
    fournisseur_id INTEGER REFERENCES public.fournisseurs(id) ON DELETE SET NULL,
    fournisseur_nom VARCHAR(255) NOT NULL,
    statut VARCHAR(50) NOT NULL DEFAULT 'BROUILLON', -- 'BROUILLON', 'ENVOYÉ', 'REÇU', 'ANNULÉ'
    total_ht NUMERIC(15, 2) DEFAULT 0,
    total_ttc NUMERIC(15, 2) DEFAULT 0,
    notes TEXT,
    created_by VARCHAR(100),
    depot_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create bon_commande_items table
CREATE TABLE IF NOT EXISTS public.bon_commande_items (
    id SERIAL PRIMARY KEY,
    bon_commande_id INTEGER NOT NULL REFERENCES public.bons_commande(id) ON DELETE CASCADE,
    article_id INTEGER REFERENCES public.articles(id) ON DELETE SET NULL,
    reference VARCHAR(100),
    designation VARCHAR(255) NOT NULL,
    quantite NUMERIC(15, 2) NOT NULL,
    prix_achat_unitaire NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_ligne NUMERIC(15, 2) NOT NULL DEFAULT 0
);

-- 3. Composite performance indexes
CREATE INDEX IF NOT EXISTS idx_bc_date_commande ON public.bons_commande (date_commande DESC);
CREATE INDEX IF NOT EXISTS idx_bc_fournisseur_id ON public.bons_commande (fournisseur_id);
CREATE INDEX IF NOT EXISTS idx_bc_statut ON public.bons_commande (statut);
CREATE INDEX IF NOT EXISTS idx_bc_items_bc_id ON public.bon_commande_items (bon_commande_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.bons_commande ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bon_commande_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for authenticated users on bons_commande"
  ON public.bons_commande FOR SELECT USING (true);

CREATE POLICY "Enable write for authenticated users on bons_commande"
  ON public.bons_commande FOR ALL USING (true);

CREATE POLICY "Enable read for authenticated users on bon_commande_items"
  ON public.bon_commande_items FOR SELECT USING (true);

CREATE POLICY "Enable write for authenticated users on bon_commande_items"
  ON public.bon_commande_items FOR ALL USING (true);
