-- =============================================================================
-- VEHICLES MANAGEMENT (GESTION DU PARC AUTOMOBILE & VÉHICULES)
-- =============================================================================

CREATE TABLE IF NOT EXISTS voitures (
    id SERIAL PRIMARY KEY,
    matricule VARCHAR(50) UNIQUE NOT NULL,
    marque VARCHAR(100),
    modele VARCHAR(100),
    annee VARCHAR(10),
    chauffeur VARCHAR(150),
    chassis VARCHAR(100),
    couleur VARCHAR(50),
    carburant VARCHAR(50) DEFAULT 'Diesel',
    transmission VARCHAR(50) DEFAULT 'Manuelle',
    moteur VARCHAR(100),
    kilometrage VARCHAR(50),
    niveau_huile VARCHAR(50) DEFAULT 'Normal',
    prix_achat NUMERIC(15, 2) DEFAULT 0,
    date_expiration DATE,
    date_assurance_exp DATE,
    notes TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000001',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS vehicle_records (
    id SERIAL PRIMARY KEY,
    voiture_id INTEGER REFERENCES voitures(id) ON DELETE CASCADE,
    record_type VARCHAR(50) NOT NULL, -- 'FRAI' or 'DEPENSE'
    category VARCHAR(100),
    record_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    amount NUMERIC(15, 2) DEFAULT 0,
    destination VARCHAR(150),
    cargo_details TEXT,
    notes TEXT,
    organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000001',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
