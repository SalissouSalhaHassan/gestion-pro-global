-- ==============================================================================
-- MIGRATION: 20260903_customer_loyalty.sql
-- DESCRIPTION: Customer Loyalty Program, Digital Membership Cards & Points Engine
-- AUTHOR: Lead Software Architect & Technical Supervisor
-- SYSTEM: Gestion Pro Global (Enterprise Edition)
-- ==============================================================================

-- 1. Add Loyalty Columns to clients
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS carte_fidelite_numero VARCHAR(50) UNIQUE,
ADD COLUMN IF NOT EXISTS points_fidelite INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS solde_cashback NUMERIC(15, 2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS niveau_fidelite VARCHAR(50) NOT NULL DEFAULT 'BRONZE';

-- Auto-populate membership card number for existing clients
UPDATE public.clients
SET carte_fidelite_numero = 'LOYAL-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(id::text, 4, '0')
WHERE carte_fidelite_numero IS NULL;

-- 2. Create transactions_points_fidelite table
CREATE TABLE IF NOT EXISTS public.transactions_points_fidelite (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    facture_id INTEGER REFERENCES public.factures(id) ON DELETE SET NULL,
    type_transaction VARCHAR(20) NOT NULL, -- 'GAIN' (Accumulation), 'UTILISATION' (Redemption)
    points INTEGER NOT NULL,
    equivalent_fcfa NUMERIC(15, 2) NOT NULL DEFAULT 0,
    motif TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Composite Indexes
CREATE INDEX IF NOT EXISTS idx_clients_carte_fidelite ON public.clients (carte_fidelite_numero);
CREATE INDEX IF NOT EXISTS idx_clients_points_fidelite ON public.clients (points_fidelite DESC);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_client_id ON public.transactions_points_fidelite (client_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_created_at ON public.transactions_points_fidelite (created_at DESC);

-- 4. Row Level Security
ALTER TABLE public.transactions_points_fidelite ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for all authenticated on transactions_points_fidelite"
  ON public.transactions_points_fidelite FOR SELECT USING (true);

CREATE POLICY "Enable write for all authenticated on transactions_points_fidelite"
  ON public.transactions_points_fidelite FOR ALL USING (true);
