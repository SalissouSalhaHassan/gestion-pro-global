import { createClient } from "@/lib/supabase/server";

export type AuditSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface LogAuditParams {
  action_type:
    | "DELETE_INVOICE"
    | "CANCEL_INVOICE"
    | "PRICE_OVERRIDE"
    | "STOCK_ADJUSTMENT"
    | "CASH_DEFICIT"
    | "CASH_EXCESS"
    | "LOGIN_FAILURE"
    | "UNAUTHORIZED_ATTEMPT"
    | "SETTINGS_CHANGED"
    | "DEBT_RESET";
  severity: AuditSeverity;
  module: "VENTES" | "CAISSE" | "STOCKS" | "FINANCE" | "AUTH" | "ADMIN";
  description: string;
  metadata?: Record<string, any>;
  target_id?: string | number;
  user_id?: number | null;
  username?: string;
  ip_address?: string;
}

export async function logAuditEvent(params: LogAuditParams) {
  try {
    const supabase = await createClient();
    await supabase.from("audit_logs").insert({
      action_type: params.action_type,
      severity: params.severity,
      module: params.module,
      description: params.description,
      metadata: params.metadata || {},
      target_id: params.target_id ? String(params.target_id) : null,
      user_id: params.user_id || null,
      username: params.username || "Système",
      ip_address: params.ip_address || "127.0.0.1",
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    // Non-blocking for the main application flow
    console.error("Failed to write audit event:", err);
  }
}
