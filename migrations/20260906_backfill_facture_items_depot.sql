-- ==============================================================================
-- Migration: Backfill depot_id on facture_items from mouvements and depots
-- Date: 2026-09-06
-- ==============================================================================

-- 1. Ensure depot_id exists and has index on facture_items
CREATE INDEX IF NOT EXISTS idx_facture_items_depot_id ON public.facture_items(depot_id);

-- 2. Backfill depot_id on facture_items by matching mouvements (nr_doc = factures.bl_number) with depots
UPDATE public.facture_items fi
SET depot_id = d.id
FROM public.factures f
JOIN public.mouvements m ON m.nr_doc = f.bl_number
JOIN public.depots d ON TRIM(LOWER(d.nom)) = TRIM(LOWER(m.depot))
WHERE fi.facture_id = f.id
  AND fi.article_id = m.article_id
  AND fi.depot_id IS NULL;

-- 3. Fallback: Backfill depot_id from factures.emplacement or users.emplacement
UPDATE public.facture_items fi
SET depot_id = d.id
FROM public.factures f
LEFT JOIN public.users u ON f.vendeur = u.utilisateur
JOIN public.depots d ON TRIM(LOWER(d.nom)) = TRIM(LOWER(COALESCE(f.emplacement, u.emplacement)))
WHERE fi.facture_id = f.id
  AND fi.depot_id IS NULL;

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
