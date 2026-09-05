-- ==============================================================================
-- MIGRATION: 20260904_cheques_and_effets.sql
-- DESCRIPTION: Check Clearing House, Commercial Papers (Traites) & Due Date Radar
-- AUTHOR: Lead Software Architect & Technical Supervisor
-- SYSTEM: Gestion Pro Global (Enterprise Treasury Edition)
-- ==============================================================================

-- 1. Table: cheques_effets
CREATE TABLE IF NOT EXISTS public.cheques_effets (
    id SERIAL PRIMARY KEY,
    type_operation VARCHAR(20) NOT NULL, -- 'A_ENCAISSER' (Client), 'EMIS' (Fournisseur)
    type_titre VARCHAR(30) NOT NULL DEFAULT 'CHEQUE', -- 'CHEQUE', 'EFFET', 'BILLET_A_ORDRE'
    numero_piece VARCHAR(100) NOT NULL,
    banque_emetteur VARCHAR(100) NOT NULL, -- e.g. SONIBANK, BIA, BOA, ECOBANK, ORABANK, BAGRI
    emetteur_nom VARCHAR(150) NOT NULL,
    beneficiaire_nom VARCHAR(150) NOT NULL,
    montant NUMERIC(15, 2) NOT NULL DEFAULT 0,
    date_emission DATE NOT NULL DEFAULT CURRENT_DATE,
    date_echeance DATE NOT NULL,
    statut VARCHAR(30) NOT NULL DEFAULT 'EN_PORTEFEUILLE', -- 'EN_PORTEFEUILLE', 'DEPOSE_BANQUE', 'ENCAISSE', 'REJETE', 'ANNULE'
    client_id INTEGER REFERENCES public.clients(id) ON DELETE SET NULL,
    fournisseur_id INTEGER REFERENCES public.fournisseurs(id) ON DELETE SET NULL,
    facture_id INTEGER REFERENCES public.factures(id) ON DELETE SET NULL,
    date_encaissement TIMESTAMP WITH TIME ZONE,
    date_depot TIMESTAMP WITH TIME ZONE,
    bordereau_remise VARCHAR(100),
    motif_rejet TEXT,
    notes TEXT,
    created_by VARCHAR(100),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Add column to existing table if already created
ALTER TABLE public.cheques_effets ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 3. Indexes for fast filtering & alert queries
CREATE INDEX IF NOT EXISTS idx_cheques_type_op ON public.cheques_effets (type_operation);
CREATE INDEX IF NOT EXISTS idx_cheques_statut ON public.cheques_effets (statut);
CREATE INDEX IF NOT EXISTS idx_cheques_date_echeance ON public.cheques_effets (date_echeance);
CREATE INDEX IF NOT EXISTS idx_cheques_client ON public.cheques_effets (client_id);
CREATE INDEX IF NOT EXISTS idx_cheques_org ON public.cheques_effets (organization_id);
CREATE INDEX IF NOT EXISTS idx_cheques_created_at ON public.cheques_effets (created_at DESC);

-- 4. Row Level Security
ALTER TABLE public.cheques_effets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for all authenticated on cheques_effets"
  ON public.cheques_effets FOR SELECT USING (true);

CREATE POLICY "Enable write for all authenticated on cheques_effets"
  ON public.cheques_effets FOR ALL USING (true);
