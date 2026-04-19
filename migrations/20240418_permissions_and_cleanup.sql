-- Migration: Advanced Permissions and Data Isolation
-- Date: 2024-04-18
-- Description: Adds created_by to isolation tables and clears existing records.

-- 1. Clear existing data as requested
TRUNCATE TABLE factures RESTART IDENTITY CASCADE;
TRUNCATE TABLE articles RESTART IDENTITY CASCADE;
TRUNCATE TABLE depenses RESTART IDENTITY CASCADE;
TRUNCATE TABLE clients RESTART IDENTITY CASCADE;
TRUNCATE TABLE mouvements RESTART IDENTITY CASCADE;
TRUNCATE TABLE stocks RESTART IDENTITY CASCADE;
TRUNCATE TABLE paiements RESTART IDENTITY CASCADE;

-- 2. Add created_by column to tables for data isolation
ALTER TABLE articles ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE depenses ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE paiements ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE mouvements ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- 3. Ensure indexes for performance on the new column
CREATE INDEX IF NOT EXISTS idx_articles_created_by ON articles(created_by);
CREATE INDEX IF NOT EXISTS idx_factures_created_by ON factures(created_by);
CREATE INDEX IF NOT EXISTS idx_depenses_created_by ON depenses(created_by);
CREATE INDEX IF NOT EXISTS idx_clients_created_by ON clients(created_by);
