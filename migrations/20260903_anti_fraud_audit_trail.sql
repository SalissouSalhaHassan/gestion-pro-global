-- ==============================================================================
-- MIGRATION: 20260903_anti_fraud_audit_trail.sql
-- DESCRIPTION: Anti-Fraud & Forensic Audit Trail (Immutable Security Logs)
-- AUTHOR: Lead Software Architect & Technical Supervisor
-- SYSTEM: Gestion Pro Global (Enterprise Edition)
-- ==============================================================================

-- 1. Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id SERIAL PRIMARY KEY,
    action_type VARCHAR(100) NOT NULL, -- 'DELETE_INVOICE', 'PRICE_OVERRIDE', 'STOCK_ADJUSTMENT', 'CASH_DEFICIT', 'LOGIN_FAILURE'
    severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM', -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    module VARCHAR(50) NOT NULL, -- 'VENTES', 'CAISSE', 'STOCKS', 'FINANCE', 'AUTH'
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    target_id VARCHAR(100),
    user_id INTEGER,
    username VARCHAR(100) NOT NULL,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    ip_address VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Support migration if table already exists without organization_id
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 2. High-performance composite indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON public.audit_logs (organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON public.audit_logs (severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON public.audit_logs (action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_username ON public.audit_logs (username);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON public.audit_logs (module);

-- 3. Row Level Security (RLS)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for authenticated users on audit_logs"
  ON public.audit_logs FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users on audit_logs"
  ON public.audit_logs FOR INSERT WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
