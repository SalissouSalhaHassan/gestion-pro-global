-- ==============================================================================
-- MIGRATION: 20260904_sales_targets_commissions.sql
-- DESCRIPTION: Sales Targets, Seller Commissions & Performance Studio 4K
-- AUTHOR: Lead Software Architect & Technical Supervisor
-- SYSTEM: Gestion Pro Global (Enterprise Edition)
-- ==============================================================================

-- 1. Table: objectifs_vendeurs (Monthly Sales Targets & Commission Rates)
CREATE TABLE IF NOT EXISTS public.objectifs_vendeurs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    mois_annee VARCHAR(7) NOT NULL, -- e.g. '2026-09'
    objectif_ca NUMERIC(15, 2) NOT NULL DEFAULT 0,
    taux_commission NUMERIC(5, 2) NOT NULL DEFAULT 2.00, -- e.g. 2.50%
    prime_bonus_atteinte NUMERIC(15, 2) NOT NULL DEFAULT 0, -- Bonus if 100% target achieved
    statut VARCHAR(20) NOT NULL DEFAULT 'ACTIF',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unq_user_mois UNIQUE (user_id, mois_annee)
);

-- 2. Table: commissions_versements (Commission Payouts / Receipts)
CREATE TABLE IF NOT EXISTS public.commissions_versements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    mois_annee VARCHAR(7) NOT NULL,
    montant_paye NUMERIC(15, 2) NOT NULL,
    moyen_paiement VARCHAR(50) NOT NULL DEFAULT 'Espèces',
    reference_recu VARCHAR(100),
    paye_le TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    paye_par VARCHAR(100),
    notes TEXT
);

-- 3. Composite Indexes
CREATE INDEX IF NOT EXISTS idx_objectifs_user_mois ON public.objectifs_vendeurs (user_id, mois_annee);
CREATE INDEX IF NOT EXISTS idx_commissions_payout_user ON public.commissions_versements (user_id, mois_annee);

-- 4. Row Level Security
ALTER TABLE public.objectifs_vendeurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions_versements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for all authenticated on objectifs_vendeurs"
  ON public.objectifs_vendeurs FOR SELECT USING (true);

CREATE POLICY "Enable write for all authenticated on objectifs_vendeurs"
  ON public.objectifs_vendeurs FOR ALL USING (true);

CREATE POLICY "Enable read for all authenticated on commissions_versements"
  ON public.commissions_versements FOR SELECT USING (true);

CREATE POLICY "Enable write for all authenticated on commissions_versements"
  ON public.commissions_versements FOR ALL USING (true);
