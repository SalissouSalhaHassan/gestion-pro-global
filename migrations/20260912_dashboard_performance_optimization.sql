-- =============================================================================
-- GESTION PRO GLOBAL - DASHBOARD PERFORMANCE OPTIMIZATION
-- Date: 2026-09-12
-- Description:
--   1. Implements get_low_stock_count(p_org_id UUID) RPC function for
--      instant server-side aggregation instead of downloading full article & stock tables.
--   2. Adds performance indexes for dashboard queries (stocks, articles, movements, factures).
-- =============================================================================

-- 1. Optimized Server-Side Low Stock Count Function
CREATE OR REPLACE FUNCTION public.get_low_stock_count(p_org_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*)::INTEGER INTO v_count
    FROM public.articles a
    LEFT JOIN (
        SELECT article_id, SUM(quantite) AS total_qty
        FROM public.stocks
        WHERE (p_org_id IS NULL OR organization_id = p_org_id)
        GROUP BY article_id
    ) s ON s.article_id = a.id
    WHERE a.is_deleted = false
      AND (p_org_id IS NULL OR a.organization_id = p_org_id)
      AND COALESCE(s.total_qty, 0) < COALESCE(a.qte_min, 0);

    RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_low_stock_count(UUID) TO authenticated, anon;

-- 2. Performance Indexes for High-Frequency Dashboard Queries
CREATE INDEX IF NOT EXISTS idx_stocks_article_org 
ON public.stocks (article_id, organization_id);

CREATE INDEX IF NOT EXISTS idx_articles_stock_alert 
ON public.articles (is_deleted, organization_id, qte_min);

CREATE INDEX IF NOT EXISTS idx_factures_dashboard_today 
ON public.factures (organization_id, is_deleted, date_facture);

CREATE INDEX IF NOT EXISTS idx_mouvements_dashboard_perf 
ON public.mouvements (organization_id, date_mouvement, type);
