-- ==============================================================================
-- MIGRATION: 20260903_multi_tier_pricing.sql
-- DESCRIPTION: Multi-Tier Pricing (Retail, Wholesale, Distributor) & Client Categories
-- AUTHOR: Lead Software Architect & Technical Supervisor
-- SYSTEM: Gestion Pro Global (Enterprise Edition)
-- ==============================================================================

-- 1. Add Wholesale & Distributor Prices to Articles
ALTER TABLE public.articles 
  ADD COLUMN IF NOT EXISTS prix_gros NUMERIC(15, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS prix_special NUMERIC(15, 2) DEFAULT NULL;

-- 2. Add Client Category / Pricing Tier to Clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS type_client VARCHAR(50) DEFAULT 'Détail';

-- 3. Comments for documentation
COMMENT ON COLUMN public.articles.prix_gros IS 'Tarif de vente de gros pour les commerçants et commandes en volume';
COMMENT ON COLUMN public.articles.prix_special IS 'Tarif spécial négocié pour revendeurs agréés et partenaires';
COMMENT ON COLUMN public.clients.type_client IS 'Catégorie tarifaire appliquée automatiquement (Détail, Gros, Revendeur)';
