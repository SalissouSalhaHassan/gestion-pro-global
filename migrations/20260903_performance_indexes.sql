-- ==============================================================================
-- MIGRATION: 20260903_performance_indexes.sql
-- DESCRIPTION: High-Performance Composite & Partial Indexes for Fast Querying
-- AUTHOR: Lead Software Architect & Technical Supervisor
-- SYSTEM: Gestion Pro Global (Enterprise Edition)
-- ==============================================================================

-- 1. FACTURES (Invoices & POS Sales Performance)
-- Accelerates date-range queries, cashier filtering, client statements, and unpaid receivables
CREATE INDEX IF NOT EXISTS idx_factures_date_statut 
  ON factures (date_facture DESC, is_deleted, statut);

CREATE INDEX IF NOT EXISTS idx_factures_client_date 
  ON factures (client_id, date_facture DESC) 
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_factures_vendeur_date 
  ON factures (vendeur, date_facture DESC) 
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_factures_bl_number 
  ON factures (bl_number);

-- Partial index for instantaneous debt & credit queries
CREATE INDEX IF NOT EXISTS idx_factures_unpaid_credit 
  ON factures (client_id, date_echeance, montant_restant) 
  WHERE montant_restant > 0 AND is_deleted = false;

-- 2. LIGNES_FACTURE (Invoice Line Items)
-- Accelerates invoice loading, printing, and sales-by-product analytics
CREATE INDEX IF NOT EXISTS idx_lignes_facture_facture_id 
  ON lignes_facture (facture_id);

CREATE INDEX IF NOT EXISTS idx_lignes_facture_article_id 
  ON lignes_facture (article_id);

-- 3. MOUVEMENTS & STOCKS (Stock Movements & Realtime Ledger)
-- Accelerates the stock auditor ledger (Avant / Variation / Après)
CREATE INDEX IF NOT EXISTS idx_mouvements_article_date 
  ON mouvements (article_id, date_mouvement DESC);

CREATE INDEX IF NOT EXISTS idx_mouvements_depot_date 
  ON mouvements (depot_id, date_mouvement DESC);

CREATE INDEX IF NOT EXISTS idx_stocks_article_depot 
  ON stocks (article_id, depot_id);

-- 4. PAIEMENTS & ENCAISSEMENTS (Payments & Cash Flow)
-- Accelerates cash balance reconciliation and payment histories
CREATE INDEX IF NOT EXISTS idx_paiements_facture_id 
  ON paiements (facture_id);

CREATE INDEX IF NOT EXISTS idx_paiements_date_moyen 
  ON paiements (date_operation DESC, moyen_reglement);

-- 5. AVANCES & ACOMPTES (Client Deposits & Movements)
-- Accelerates client statement calculations and deposit receipt generation
CREATE INDEX IF NOT EXISTS idx_avances_client_statut 
  ON avances_clients (client_id, statut, date_avance DESC);

CREATE INDEX IF NOT EXISTS idx_avances_mouvements_avance_id 
  ON avances_mouvements (avance_id, date_mouvement DESC);

CREATE INDEX IF NOT EXISTS idx_avances_mouvements_client_id 
  ON avances_mouvements (client_id, date_mouvement DESC);

-- 6. ARTICLES & CATALOGUE (Barcode Search & POS Lookups)
-- Enables instant barcode scanner resolution in POS
CREATE INDEX IF NOT EXISTS idx_articles_code_barre 
  ON articles (code_barre) 
  WHERE code_barre IS NOT NULL AND is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_articles_reference 
  ON articles (reference) 
  WHERE is_deleted = false;

-- 7. DÉPENSES & TRÉSORERIE (Expenses & Cash Audits)
CREATE INDEX IF NOT EXISTS idx_depenses_date_categorie 
  ON depenses (date_depense DESC, categorie);

CREATE INDEX IF NOT EXISTS idx_depenses_operateur 
  ON depenses (operateur, date_depense DESC);
