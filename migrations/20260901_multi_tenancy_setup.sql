-- =============================================================================
-- GESTION PRO GLOBAL - MULTI-TENANCY & ORGANIZATIONS MIGRATION
-- =============================================================================

-- 1. Create Organizations Table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE,
    country VARCHAR(100) DEFAULT 'International',
    currency VARCHAR(20) DEFAULT 'FCFA',
    logo_url TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan VARCHAR(50) DEFAULT 'trial', -- 'trial', 'starter', 'pro', 'enterprise'
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'expired', 'canceled', 'past_due'
    trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
    current_period_start TIMESTAMPTZ DEFAULT NOW(),
    current_period_end TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
    max_users INT DEFAULT 5,
    max_depots INT DEFAULT 3,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Seed Default Primary Organization (for legacy & root system)
INSERT INTO organizations (id, name, slug, country, currency, is_active)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'GESTION PRO GLOBAL',
    'gestion-pro-global',
    'International',
    'FCFA',
    TRUE
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO subscriptions (organization_id, plan, status, max_users, max_depots)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'enterprise',
    'active',
    9999,
    9999
)
ON CONFLICT DO NOTHING;

-- 4. Add organization_id column to all core business tables
DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'users',
        'roles',
        'depots',
        'articles',
        'categories',
        'groupes',
        'types',
        'clients',
        'fournisseurs',
        'factures',
        'facture_items',
        'achats',
        'achat_items',
        'stocks',
        'mouvements',
        'depenses',
        'loyers',
        'contrats',
        'activity_log',
        'parametres_numerotation',
        'informations_entreprise',
        'user_warehouses'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE DEFAULT ''00000000-0000-0000-0000-000000000001'';', t);
            EXECUTE format('UPDATE %I SET organization_id = ''00000000-0000-0000-0000-000000000001'' WHERE organization_id IS NULL;', t);
            EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_organization_id ON %I (organization_id);', t, t);
        END IF;
    END LOOP;
END $$;
