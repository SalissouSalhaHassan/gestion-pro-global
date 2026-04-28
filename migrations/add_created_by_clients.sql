-- Migration: Add created_by column to clients table
-- Purpose: Enable per-user client data isolation for Dépôt users
-- Admin/Manager users retain full access to all clients
-- Dépôt users can only see/edit clients they created

-- 1. Add the created_by column (nullable, since existing clients have no owner)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS created_by INTEGER;

-- 2. Create index for fast filtered queries
CREATE INDEX IF NOT EXISTS idx_clients_created_by ON clients(created_by);

-- NOTE: Existing clients without created_by (NULL) will only be visible to Admin/Manager users.
-- The default client (ID=1, "CLIENT COMPTANT") remains visible to all users regardless.
