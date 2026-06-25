-- Migration: ERP Hierarchy & Multi-Depot Implementation
-- Date: 2026-06-25
-- Description: Adds tables for Entreprises, Agences, Points de Vente, Permissions, and Transfer Workflow.
-- Adds backward-compatibility columns and triggers to sync ID with text-based depot names.

-- 1. Create ERP Hierarchy Tables
CREATE TABLE IF NOT EXISTS entreprises (
    id SERIAL PRIMARY KEY,
    nom_entreprise TEXT NOT NULL,
    adresse TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS agences (
    id SERIAL PRIMARY KEY,
    nom_agence TEXT NOT NULL,
    adresse TEXT,
    entreprise_id INTEGER REFERENCES entreprises(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Extend existing depots table with agency and enterprise links
ALTER TABLE depots ADD COLUMN IF NOT EXISTS agence_id INTEGER REFERENCES agences(id) ON DELETE SET NULL;
ALTER TABLE depots ADD COLUMN IF NOT EXISTS entreprise_id INTEGER REFERENCES entreprises(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS points_de_vente (
    id SERIAL PRIMARY KEY,
    nom_pos TEXT NOT NULL,
    depot_id INTEGER REFERENCES depots(id) ON DELETE SET NULL,
    agence_id INTEGER REFERENCES agences(id) ON DELETE SET NULL,
    entreprise_id INTEGER REFERENCES entreprises(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Liaison Vendeur <-> Point de Vente
CREATE TABLE IF NOT EXISTS user_pos (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    pos_id INTEGER REFERENCES points_de_vente(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, pos_id)
);

-- Permissions by Depot
CREATE TABLE IF NOT EXISTS warehouse_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    depot_id INTEGER REFERENCES depots(id) ON DELETE CASCADE,
    can_sell BOOLEAN DEFAULT true,
    can_view BOOLEAN DEFAULT true,
    can_inventory BOOLEAN DEFAULT false,
    can_transfer BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, depot_id)
);

-- Warehouse Managers
CREATE TABLE IF NOT EXISTS warehouse_managers (
    id SERIAL PRIMARY KEY,
    depot_id INTEGER REFERENCES depots(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(depot_id, user_id)
);

-- 2. Extend user_warehouses with primary flag
ALTER TABLE user_warehouses ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;

-- 3. Extend stock and transactions tables for warehouse/hierarchy references
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS warehouse_id INTEGER REFERENCES depots(id) ON DELETE SET NULL;
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS agence_id INTEGER REFERENCES agences(id) ON DELETE SET NULL;

ALTER TABLE mouvements ADD COLUMN IF NOT EXISTS warehouse_id INTEGER REFERENCES depots(id) ON DELETE SET NULL;
ALTER TABLE mouvements ADD COLUMN IF NOT EXISTS pos_id INTEGER REFERENCES points_de_vente(id) ON DELETE SET NULL;
ALTER TABLE mouvements ADD COLUMN IF NOT EXISTS agence_id INTEGER REFERENCES agences(id) ON DELETE SET NULL;
ALTER TABLE mouvements ADD COLUMN IF NOT EXISTS entreprise_id INTEGER REFERENCES entreprises(id) ON DELETE SET NULL;

ALTER TABLE factures ADD COLUMN IF NOT EXISTS warehouse_id INTEGER REFERENCES depots(id) ON DELETE SET NULL;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS pos_id INTEGER REFERENCES points_de_vente(id) ON DELETE SET NULL;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS agence_id INTEGER REFERENCES agences(id) ON DELETE SET NULL;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS entreprise_id INTEGER REFERENCES entreprises(id) ON DELETE SET NULL;

-- 4. Stock Transfer Workflow Tables
CREATE TABLE IF NOT EXISTS transferts_stock (
    id SERIAL PRIMARY KEY,
    reference TEXT UNIQUE NOT NULL,
    depot_depart_id INTEGER NOT NULL REFERENCES depots(id),
    depot_arrivee_id INTEGER NOT NULL REFERENCES depots(id),
    statut TEXT NOT NULL DEFAULT 'Demande', -- 'Demande', 'Valide', 'Prepare', 'Expedie', 'Recu', 'Confirme'
    date_transfert TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS transfert_items (
    id SERIAL PRIMARY KEY,
    transfert_id INTEGER NOT NULL REFERENCES transferts_stock(id) ON DELETE CASCADE,
    article_id INTEGER NOT NULL REFERENCES articles(id),
    quantite INTEGER NOT NULL CHECK (quantite > 0)
);

CREATE TABLE IF NOT EXISTS transferts_etapes (
    id SERIAL PRIMARY KEY,
    transfert_id INTEGER NOT NULL REFERENCES transferts_stock(id) ON DELETE CASCADE,
    statut TEXT NOT NULL,
    utilisateur TEXT NOT NULL,
    date_etape TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    remarque TEXT
);

-- 5. Create Double-Write Sync Triggers
-- A. Stocks Sync Trigger
CREATE OR REPLACE FUNCTION sync_stocks_depot_columns()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.warehouse_id IS NOT NULL AND NEW.depot_nom IS NULL THEN
        SELECT nom INTO NEW.depot_nom FROM depots WHERE id = NEW.warehouse_id;
    ELSIF NEW.depot_nom IS NOT NULL AND NEW.warehouse_id IS NULL THEN
        SELECT id INTO NEW.warehouse_id FROM depots WHERE nom = NEW.depot_nom;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_stocks_depot ON stocks;
CREATE TRIGGER trg_sync_stocks_depot
    BEFORE INSERT OR UPDATE ON stocks
    FOR EACH ROW
    EXECUTE FUNCTION sync_stocks_depot_columns();

-- B. Mouvements Sync Trigger
CREATE OR REPLACE FUNCTION sync_mouvements_depot_columns()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.warehouse_id IS NOT NULL AND NEW.depot IS NULL THEN
        SELECT nom INTO NEW.depot FROM depots WHERE id = NEW.warehouse_id;
    ELSIF NEW.depot IS NOT NULL AND NEW.warehouse_id IS NULL THEN
        SELECT id INTO NEW.warehouse_id FROM depots WHERE nom = NEW.depot;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_mouvements_depot ON mouvements;
CREATE TRIGGER trg_sync_mouvements_depot
    BEFORE INSERT OR UPDATE ON mouvements
    FOR EACH ROW
    EXECUTE FUNCTION sync_mouvements_depot_columns();

-- C. Factures Sync Trigger
CREATE OR REPLACE FUNCTION sync_factures_depot_columns()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.warehouse_id IS NOT NULL AND NEW.emplacement IS NULL THEN
        SELECT nom INTO NEW.emplacement FROM depots WHERE id = NEW.warehouse_id;
    ELSIF NEW.emplacement IS NOT NULL AND NEW.warehouse_id IS NULL THEN
        SELECT id INTO NEW.warehouse_id FROM depots WHERE nom = NEW.emplacement;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_factures_depot ON factures;
CREATE TRIGGER trg_sync_factures_depot
    BEFORE INSERT OR UPDATE ON factures
    FOR EACH ROW
    EXECUTE FUNCTION sync_factures_depot_columns();

-- D. Autofill ERP hierarchy on factures
CREATE OR REPLACE FUNCTION autofill_factures_hierarchy()
RETURNS TRIGGER AS $$
DECLARE
    v_agence_id INT;
    v_entreprise_id INT;
    v_pos_id INT;
    v_default_pos_id INT;
BEGIN
    IF NEW.warehouse_id IS NOT NULL THEN
        -- Lookup depot's agency and enterprise
        SELECT agence_id, entreprise_id INTO v_agence_id, v_entreprise_id FROM depots WHERE id = NEW.warehouse_id;
        NEW.agence_id := COALESCE(NEW.agence_id, v_agence_id);
        NEW.entreprise_id := COALESCE(NEW.entreprise_id, v_entreprise_id);
        
        -- Find a POS linked to this user and depot, or fall back to any POS of this depot
        IF NEW.created_by IS NOT NULL THEN
            SELECT pos_id INTO v_pos_id 
            FROM user_pos up
            JOIN points_de_vente p ON up.pos_id = p.id
            WHERE up.user_id = NEW.created_by AND p.depot_id = NEW.warehouse_id
            LIMIT 1;
        END IF;

        IF v_pos_id IS NULL THEN
            SELECT id INTO v_default_pos_id FROM points_de_vente WHERE depot_id = NEW.warehouse_id LIMIT 1;
            v_pos_id := v_default_pos_id;
        END IF;

        NEW.pos_id := COALESCE(NEW.pos_id, v_pos_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_autofill_factures_hierarchy ON factures;
CREATE TRIGGER trg_autofill_factures_hierarchy
    BEFORE INSERT OR UPDATE ON factures
    FOR EACH ROW
    EXECUTE FUNCTION autofill_factures_hierarchy();

-- E. Autofill ERP hierarchy on mouvements
CREATE OR REPLACE FUNCTION autofill_mouvements_hierarchy()
RETURNS TRIGGER AS $$
DECLARE
    v_agence_id INT;
    v_entreprise_id INT;
    v_pos_id INT;
    v_default_pos_id INT;
BEGIN
    IF NEW.warehouse_id IS NOT NULL THEN
        SELECT agence_id, entreprise_id INTO v_agence_id, v_entreprise_id FROM depots WHERE id = NEW.warehouse_id;
        NEW.agence_id := COALESCE(NEW.agence_id, v_agence_id);
        NEW.entreprise_id := COALESCE(NEW.entreprise_id, v_entreprise_id);
        
        IF NEW.user_id IS NOT NULL THEN
            SELECT pos_id INTO v_pos_id 
            FROM user_pos up
            JOIN points_de_vente p ON up.pos_id = p.id
            WHERE up.user_id = NEW.user_id AND p.depot_id = NEW.warehouse_id
            LIMIT 1;
        END IF;

        IF v_pos_id IS NULL THEN
            SELECT id INTO v_default_pos_id FROM points_de_vente WHERE depot_id = NEW.warehouse_id LIMIT 1;
            v_pos_id := v_default_pos_id;
        END IF;

        NEW.pos_id := COALESCE(NEW.pos_id, v_pos_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_autofill_mouvements_hierarchy ON mouvements;
CREATE TRIGGER trg_autofill_mouvements_hierarchy
    BEFORE INSERT OR UPDATE ON mouvements
    FOR EACH ROW
    EXECUTE FUNCTION autofill_mouvements_hierarchy();

-- 6. Initial Data Seeding & Migrations
-- A. Default Enterprise
INSERT INTO entreprises (nom_entreprise, adresse)
SELECT COALESCE((SELECT nom_entreprise FROM informations_entreprise LIMIT 1), 'Entreprise Principale'), 'Adresse Principale'
WHERE NOT EXISTS (SELECT 1 FROM entreprises);

-- B. Default Agency
INSERT INTO agences (nom_agence, adresse, entreprise_id)
SELECT 'Agence Principale', 'Adresse Agence', (SELECT id FROM entreprises LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM agences);

-- C. Link existing depots to default agency/enterprise
UPDATE depots 
SET agence_id = (SELECT id FROM agences LIMIT 1),
    entreprise_id = (SELECT id FROM entreprises LIMIT 1)
WHERE agence_id IS NULL;

-- D. Create a default Point de Vente for each depot to complete hierarchy
INSERT INTO points_de_vente (nom_pos, depot_id, agence_id, entreprise_id)
SELECT 'POS - ' || nom, id, agence_id, entreprise_id
FROM depots d
WHERE NOT EXISTS (SELECT 1 FROM points_de_vente WHERE depot_id = d.id);

-- E. Backfill warehouse_id for existing stocks
UPDATE stocks s
SET warehouse_id = d.id,
    agence_id = d.agence_id
FROM depots d
WHERE s.depot_nom = d.nom AND s.warehouse_id IS NULL;

-- F. Backfill warehouse_id for existing mouvements
UPDATE mouvements m
SET warehouse_id = d.id,
    agence_id = d.agence_id,
    entreprise_id = d.entreprise_id
FROM depots d
WHERE m.depot = d.nom AND m.warehouse_id IS NULL;

-- G. Backfill warehouse_id for existing factures
UPDATE factures f
SET warehouse_id = d.id,
    agence_id = d.agence_id,
    entreprise_id = d.entreprise_id
FROM depots d
WHERE f.emplacement = d.nom AND f.warehouse_id IS NULL;

-- H. Set primary depots in user_warehouses from users.emplacement
UPDATE user_warehouses uw
SET is_primary = true
FROM users u, depots d
WHERE uw.user_id = u.id 
  AND uw.depot_id = d.id 
  AND u.emplacement = d.nom
  AND NOT EXISTS (SELECT 1 FROM user_warehouses WHERE user_id = uw.user_id AND is_primary = true);

-- I. Set default user_pos relationships based on user_warehouses
INSERT INTO user_pos (user_id, pos_id, is_primary)
SELECT uw.user_id, p.id, uw.is_primary
FROM user_warehouses uw
JOIN points_de_vente p ON p.depot_id = uw.depot_id
ON CONFLICT (user_id, pos_id) DO NOTHING;
