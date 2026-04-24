-- Create Ciment Shipments Table
CREATE TABLE IF NOT EXISTS public.gestion_ciment (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_tel TEXT NOT NULL,
    camion_no TEXT NOT NULL,
    transporteur TEXT,
    type_ciment TEXT,
    destination TEXT,
    chauffeur TEXT,
    chauffeur_tel TEXT,
    bons TEXT,
    arrivage TEXT,
    tonnage NUMERIC NOT NULL,
    pu NUMERIC NOT NULL,
    frais_ciment NUMERIC DEFAULT 0,
    frais_transport NUMERIC DEFAULT 0,
    tva_pourcentage NUMERIC DEFAULT 19,
    bic_pourcentage NUMERIC DEFAULT 2,
    total NUMERIC NOT NULL,
    montant_paye NUMERIC DEFAULT 0,
    statut_paiement TEXT DEFAULT 'Non Payé',
    utilisateur TEXT,
    user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Ciment Payments Table
CREATE TABLE IF NOT EXISTS public.ciment_paiements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ciment_id UUID NOT NULL REFERENCES public.gestion_ciment(id) ON DELETE CASCADE,
    montant NUMERIC NOT NULL,
    moyen_paiement TEXT NOT NULL,
    reference TEXT,
    date_paiement TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    utilisateur TEXT,
    user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Optional: Enable Row Level Security (RLS)
-- ALTER TABLE public.gestion_ciment ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.ciment_paiements ENABLE ROW LEVEL SECURITY;

