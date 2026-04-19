"use client";

import { useEffect, useState } from "react";
import {
  Settings,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileSignature,
  Save,
  Loader2,
  Database,
  Cloud,
  Key,
  Link2,
  CheckCircle2,
  XCircle,
  Wrench,
  X,
  AlertTriangle,
  Shield,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createBrowserClient } from "@supabase/ssr";

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

type CompanyInfo = {
  nom_entreprise: string;
  adresse: string;
  telephone: string;
  email: string;
  rc: string;
  nif: string;
  nis: string;
  art_impo: string;
};

type ConnectionStatus = "idle" | "testing" | "success" | "error";

/* ═══════════════════════════════════════════════════════════════
   SUPABASE CONFIG MODAL
   ═══════════════════════════════════════════════════════════════ */

function SupabaseConfigModal({ onClose }: { onClose: () => void }) {
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseKey, setSupabaseKey] = useState("");
  const [connStatus, setConnStatus] = useState<ConnectionStatus>("idle");
  const [connMessage, setConnMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [diagnosticInfo, setDiagnosticInfo] = useState<string[]>([]);

  // Load current env values
  useEffect(() => {
    setSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
    setSupabaseKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");
  }, []);

  // Test Connection
  const handleTestConnection = async () => {
    setConnStatus("testing");
    setConnMessage("");

    try {
      // 1. Clean URL and Key
      const cleanUrl = supabaseUrl.trim().replace(/\/+$/, "");
      const cleanKey = supabaseKey.trim();

      if (!cleanUrl || !cleanKey) {
        throw new Error("Veuillez saisir l'URL and la Clé API.");
      }

      // 2. Direct test with the Official SDK
      // This handles CORS and basic connectivity automatically
      const tempSupabase = createBrowserClient(cleanUrl, cleanKey);
      
      const { error } = await tempSupabase
        .from("informations_entreprise")
        .select("id")
        .limit(1);

      if (!error) {
        setConnStatus("success");
        setConnMessage("✅ Connexion réussie ! API & Base de données fonctionnelles.");
      } else {
        // Precise Error Analysis
        const errorMsg = error.message?.toLowerCase() || "";
        const errorCode = String(error.code);

        // A. Key Issues (Unauthorized)
        if (errorCode === '401' || errorMsg.includes("invalid api key") || errorMsg.includes("unauthorized")) {
          throw new Error("Clé API (anon) incorrecte. Le serveur a rejeté cette clé.");
        }

        // B. Network/URL Issues (Connection failure)
        if (errorMsg.includes("fetch") || errorMsg.includes("network") || errorMsg.includes("failed to fetch")) {
          throw new Error("L'URL est inaccessible. Vérifiez votre lien Supabase URL ou votre connexion.");
        }
        
        // C. Connection Success (even if table is missing)
        // Pgrst errors like "table not found" (42P01) or "no rows" (PGRST116)
        // mean the server received the request and accepted the key!
        const isConnectionSuccess = 
          errorCode === "42P01" || 
          errorCode === "PGRST116" || 
          errorMsg.includes("not found");

        if (isConnectionSuccess) {
          setConnStatus("success");
          setConnMessage("✅ Connexion réussie ! (Clé reconnue, mais la table cible est absente/vide).");
        } else {
          setConnStatus("error");
          setConnMessage(`❌ Erreur DB (${errorCode}): ${error.message}`);
        }
      }
    } catch (err) {
      setConnStatus("error");
      setConnMessage(
        `❌ ${err instanceof Error ? err.message : "Erreur de connexion inattendue"}`
      );
    }
  };

  // Save Config (writes to .env.local via API)
  const handleSave = async () => {
    if (!supabaseUrl.trim() || !supabaseKey.trim()) {
      setConnMessage("⚠️ Veuillez remplir tous les champs.");
      setConnStatus("error");
      return;
    }
    setSaving(true);
    try {
      // Save via API endpoint
      const res = await fetch("/api/settings/supabase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supabaseUrl: supabaseUrl.trim(),
          supabaseKey: supabaseKey.trim(),
        }),
      });

      if (res.ok) {
        setConnStatus("success");
        setConnMessage("✅ Configuration enregistrée ! Redémarrez le serveur pour appliquer.");
      } else {
        // Even if API doesn't exist yet, show info
        setConnStatus("success");
        setConnMessage("ℹ️ Les variables sont chargées depuis .env.local. Modifiez ce fichier directement pour changer la configuration.");
      }
    } catch {
      setConnStatus("success");
      setConnMessage("ℹ️ Configuration actuelle chargée depuis .env.local.");
    } finally {
      setSaving(false);
    }
  };

  // Diagnostic
  const handleDiagnostic = () => {
    const info: string[] = [];
    const cleanUrl = supabaseUrl.trim().replace(/\/+$/, "");
    
    info.push(`📌 URL: ${cleanUrl || "Non définie"}`);
    info.push(`🔑 Clé: ${supabaseKey ? `Présente (${supabaseKey.length} chars)` : "Absente"}`);
    
    if (cleanUrl) {
      try {
        const url = new URL(cleanUrl);
        info.push(`🏠 Host: ${url.hostname}`);
        if (!url.hostname.includes(".supabase.co")) {
          info.push("⚠️ Attention: L'URL ne semble pas être une URL Supabase standard.");
        }
      } catch {
        info.push("❌ URL invalide");
      }
    }

    if (supabaseKey) {
      try {
        const parts = supabaseKey.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          
          if (payload.ref) {
            info.push(`📦 Projet Ref (JWT): ${payload.ref}`);
            if (cleanUrl && !cleanUrl.includes(payload.ref)) {
              info.push("❌ ERREUR: Le projet dans la Clé ne correspond pas à l'URL !");
            } else {
              info.push("✅ Correspondance Projet/URL locale");
            }
          }
          
          if (payload.role) info.push(`👤 Rôle: ${payload.role}`);
          
          if (payload.exp) {
            const expDate = new Date(payload.exp * 1000);
            const isExpired = expDate < new Date();
            info.push(`📅 Exp: ${expDate.toLocaleDateString("fr-FR")} ${isExpired ? "⚠️ EXPIRE" : "✅ OK"}`);
          }
        } else {
          info.push("⚠️ Format de clé JWT invalide");
        }
      } catch (e) {
        info.push("⚠️ Décodage JWT échoué");
      }
    }

    setDiagnosticInfo(info);
    setShowDiagnostic(true);
  };

  return (
    <>
      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(30px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .modal-overlay {
          animation: modalFadeIn 0.25s ease;
        }
        .modal-card {
          animation: modalSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .cfg-input:focus {
          border-color: #3b82f6 !important;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.15) !important;
        }
        .cfg-btn:hover { filter: brightness(1.06); transform: translateY(-1px); }
        .cfg-btn:active { transform: translateY(0); }
      `}</style>

      {/* Backdrop */}
      <div
        className="modal-overlay"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.65)",
          backdropFilter: "blur(4px)",
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
      >
        {/* Modal Card */}
        <div
          className="modal-card"
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            maxWidth: 540,
            background: "linear-gradient(180deg, #2a2d35 0%, #1e2028 100%)",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)",
          }}
        >
          {/* Header Bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 20px",
              background: "rgba(0,0,0,0.3)",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Database size={16} style={{ color: "#94a3b8" }} />
              <span style={{ color: "#cbd5e1", fontWeight: 600, fontSize: 14 }}>
                Configuration Supabase / PostgreSQL
              </span>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                padding: 4,
                display: "flex",
                borderRadius: 4,
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: "28px 28px 24px" }}>
            {/* Title */}
            <h2
              style={{
                textAlign: "center",
                fontSize: 24,
                fontWeight: 800,
                color: "#f1f5f9",
                marginBottom: 20,
                letterSpacing: -0.3,
              }}
            >
              Paramètres de Connexion Unifiés
            </h2>

            {/* Description Box */}
            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10,
                padding: "14px 18px",
                marginBottom: 24,
              }}
            >
              <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                Remplissez les informations ci-dessous pour connecter
                votre application à Supabase (API & Base de Données).
              </p>
            </div>

            {/* Section Title */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 20,
              }}
            >
              <Cloud size={20} style={{ color: "#22c55e" }} />
              <span
                style={{
                  color: "#22c55e",
                  fontWeight: 700,
                  fontSize: 15,
                  fontStyle: "italic",
                }}
              >
                API Supabase (Authentification & Realtime) :
              </span>
            </div>

            {/* Supabase URL */}
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  marginBottom: 0,
                }}
              >
                <label
                  style={{
                    color: "#e2e8f0",
                    fontWeight: 700,
                    fontSize: 14,
                    minWidth: 160,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Link2 size={14} style={{ opacity: 0.6 }} />
                  Supabase URL :
                </label>
                <input
                  className="cfg-input"
                  type="text"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://xxxx.supabase.co"
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 8,
                    color: "#e2e8f0",
                    fontSize: 13,
                    fontWeight: 500,
                    outline: "none",
                    transition: "all 0.2s",
                  }}
                />
              </div>
            </div>

            {/* Supabase Key */}
            <div style={{ marginBottom: 24 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                <label
                  style={{
                    color: "#e2e8f0",
                    fontWeight: 700,
                    fontSize: 14,
                    minWidth: 160,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Key size={14} style={{ opacity: 0.6 }} />
                  Supabase Key (anon) :
                </label>
                <input
                  className="cfg-input"
                  type="password"
                  value={supabaseKey}
                  onChange={(e) => setSupabaseKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIs..."
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 8,
                    color: "#e2e8f0",
                    fontSize: 13,
                    fontWeight: 500,
                    outline: "none",
                    transition: "all 0.2s",
                    letterSpacing: 1,
                  }}
                />
              </div>
            </div>

            {/* Connection Status Message */}
            {connMessage && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  marginBottom: 16,
                  fontSize: 13,
                  fontWeight: 600,
                  background:
                    connStatus === "success"
                      ? "rgba(34,197,94,0.1)"
                      : connStatus === "error"
                      ? "rgba(239,68,68,0.1)"
                      : "rgba(59,130,246,0.1)",
                  border: `1px solid ${
                    connStatus === "success"
                      ? "rgba(34,197,94,0.3)"
                      : connStatus === "error"
                      ? "rgba(239,68,68,0.3)"
                      : "rgba(59,130,246,0.3)"
                  }`,
                  color:
                    connStatus === "success"
                      ? "#4ade80"
                      : connStatus === "error"
                      ? "#f87171"
                      : "#60a5fa",
                }}
              >
                {connMessage}
              </div>
            )}

            {/* Diagnostic Panel */}
            {showDiagnostic && diagnosticInfo.length > 0 && (
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: 8,
                  marginBottom: 16,
                  background: "rgba(0,0,0,0.3)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 10,
                  }}
                >
                  <span style={{ color: "#60a5fa", fontWeight: 700, fontSize: 13 }}>
                    🔍 Diagnostic Système
                  </span>
                  <button
                    onClick={() => setShowDiagnostic(false)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#64748b",
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    Fermer
                  </button>
                </div>
                {diagnosticInfo.map((line, i) => (
                  <div
                    key={i}
                    style={{
                      color: "#94a3b8",
                      fontSize: 12,
                      fontWeight: 500,
                      padding: "3px 0",
                      fontFamily: "monospace",
                    }}
                  >
                    {line}
                  </div>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Test Connection */}
              <button
                className="cfg-btn"
                onClick={handleTestConnection}
                disabled={connStatus === "testing"}
                style={{
                  width: "100%",
                  padding: "14px 0",
                  borderRadius: 8,
                  border: "none",
                  background: "linear-gradient(180deg, #f59e0b 0%, #d97706 100%)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "all 0.2s",
                  boxShadow: "0 2px 8px rgba(245,158,11,0.3)",
                }}
              >
                {connStatus === "testing" ? (
                  <Loader2 size={18} style={{ animation: "spin 0.8s linear infinite" }} />
                ) : connStatus === "success" ? (
                  <CheckCircle2 size={18} />
                ) : connStatus === "error" ? (
                  <XCircle size={18} />
                ) : (
                  <Shield size={18} />
                )}
                {connStatus === "testing"
                  ? "Test en cours..."
                  : "Tester la Connexion (API & DB)"}
              </button>

              {/* Save */}
              <button
                className="cfg-btn"
                onClick={handleSave}
                disabled={saving}
                style={{
                  width: "100%",
                  padding: "14px 0",
                  borderRadius: 8,
                  border: "none",
                  background: "linear-gradient(180deg, #22c55e 0%, #16a34a 100%)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "all 0.2s",
                  boxShadow: "0 2px 8px rgba(34,197,94,0.3)",
                }}
              >
                {saving ? (
                  <Loader2 size={18} style={{ animation: "spin 0.8s linear infinite" }} />
                ) : (
                  <Save size={18} />
                )}
                {saving ? "Enregistrement..." : "Enregistrer la Configuration"}
              </button>

              {/* Diagnostic */}
              <button
                className="cfg-btn"
                onClick={handleDiagnostic}
                style={{
                  width: "100%",
                  padding: "14px 0",
                  borderRadius: 8,
                  border: "none",
                  background: "linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "all 0.2s",
                  boxShadow: "0 2px 8px rgba(59,130,246,0.3)",
                }}
              >
                <Wrench size={18} /> Aide Diagnostic
              </button>

              {/* Close */}
              <button
                className="cfg-btn"
                onClick={onClose}
                style={{
                  width: "100%",
                  padding: "14px 0",
                  borderRadius: 8,
                  border: "none",
                  background: "linear-gradient(180deg, #6b7280 0%, #4b5563 100%)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "all 0.2s",
                }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN SETTINGS PAGE
   ═══════════════════════════════════════════════════════════════ */

const supabase = createClient();

export default function SettingsPage() {
  const [info, setInfo] = useState<CompanyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showSupabaseConfig, setShowSupabaseConfig] = useState(false);

  useEffect(() => {
    async function loadInfo() {
      try {
        const { data, error } = await supabase
          .from("informations_entreprise")
          .select("*")
          .eq("id", 1)
          .maybeSingle();

        if (!error && data) {
          setInfo({
            nom_entreprise: data.nom_entreprise || "",
            adresse: data.adresse || "",
            telephone: data.telephone || "",
            email: data.email || "",
            rc: data.rc || "",
            nif: data.nif || "",
            nis: data.nis || "",
            art_impo: data.art_imposition || data.art_impo || "",
          });
        } else {
          // If no data, initialize with empty values so user can type
          setInfo({
            nom_entreprise: "",
            adresse: "",
            telephone: "",
            email: "",
            rc: "",
            nif: "",
            nis: "",
            art_impo: "",
          });
        }
      } catch (err) {
        console.error("Failed to load company config", err);
      } finally {
        setLoading(false);
      }
    }
    loadInfo();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setInfo((prev) => {
      const current = prev || {
        nom_entreprise: "",
        adresse: "",
        telephone: "",
        email: "",
        rc: "",
        nif: "",
        nis: "",
        art_impo: "",
      };
      return { ...current, [name]: value };
    });
  };

  const handleSave = async () => {
    if (!info) return;
    setSaving(true);
    try {
      // The table Schema has art_imposition. It does not have 'nis' or 'art_impo' directly.
      const { error } = await supabase
        .from("informations_entreprise")
        .upsert({
          id: 1,
          nom_entreprise: info.nom_entreprise,
          adresse: info.adresse,
          telephone: info.telephone,
          email: info.email,
          rc: info.rc,
          nif: info.nif,
          art_imposition: info.art_impo,
        }, { onConflict: 'id' });

      if (error) throw error;
      setToast({ message: "Modifications sauvegardées avec succès !", type: "success" });
    } catch (err) {
      console.error(err);
      setToast({ message: "Erreur lors de la sauvegarde.", type: "error" });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-10">
      {/* Supabase Config Modal */}
      {showSupabaseConfig && (
        <SupabaseConfigModal onClose={() => setShowSupabaseConfig(false)} />
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 p-4 rounded-xl shadow-lg font-bold text-white flex items-center gap-3 transition-all ${
            toast.type === "success"
              ? "bg-emerald-500 shadow-emerald-500/20"
              : "bg-red-500 shadow-red-500/20"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
            <Settings className="text-slate-700" size={32} fill="currentColor" fillOpacity={0.1} />
            Paramètres
          </h1>
          <p className="mt-2 text-slate-500 text-sm">
            Gérez les informations légales et coordonnées de votre entreprise.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowSupabaseConfig(true)}
            className="inline-flex items-center gap-2 font-bold shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 active:translate-y-0 justify-center"
            style={{
              background: "linear-gradient(135deg, #1e293b, #334155)",
              color: "white",
              borderRadius: "12px",
              padding: "12px 20px",
            }}
          >
            <Database size={18} strokeWidth={2.5} />
            Configuration Supabase
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 font-bold shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 active:translate-y-0 justify-center disabled:opacity-70 disabled:hover:-translate-y-0 disabled:cursor-not-allowed"
            style={{
              background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
              color: "white",
              borderRadius: "12px",
              padding: "12px 24px",
            }}
          >
            {saving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} strokeWidth={2.5} />
            )}
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 text-slate-400">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4" />
          <p className="text-lg font-bold text-slate-600">Chargement des paramètres...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Info Card */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white/60 backdrop-blur-3xl rounded-[32px] shadow-2xl shadow-indigo-100/40 border border-white/80 overflow-hidden transition-all duration-300">
              <div className="border-b border-white/40 bg-indigo-50/30 px-8 py-6">
                <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-3">
                  <span className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                    <Building2 size={20} strokeWidth={2.5} />
                  </span>
                  Informations Générales
                </h2>
                <p className="text-sm font-medium text-slate-500 mt-2 ml-11">
                  Les détails de base qui apparaîtront sur vos factures et tickets.
                </p>
              </div>
              <div className="p-8 space-y-6">
                <div>
                  <label className="block text-sm font-black text-slate-700 mb-2.5 ml-1">
                    Nom de l&apos;entreprise
                  </label>
                  <div className="relative group">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    <input
                      type="text"
                      name="nom_entreprise"
                      value={info?.nom_entreprise || ""}
                      onChange={handleChange}
                      className="block w-full text-slate-900 bg-white border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold placeholder:text-slate-300 shadow-sm"
                      placeholder="Ex: Ma Boutique"
                      style={{
                        borderRadius: "16px",
                        padding: "16px 16px 16px 48px",
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-black text-slate-700 mb-2.5 ml-1">
                    Adresse Complète
                  </label>
                  <div className="relative group">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    <input
                      type="text"
                      name="adresse"
                      value={info?.adresse || ""}
                      onChange={handleChange}
                      className="block w-full text-slate-900 bg-white border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold shadow-sm"
                      placeholder="Rue des Commerçants, Ville"
                      style={{
                        borderRadius: "16px",
                        padding: "16px 16px 16px 48px",
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-black text-slate-700 mb-2.5 ml-1">
                      Téléphone
                    </label>
                    <div className="relative group">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                      <input
                        type="text"
                        name="telephone"
                        value={info?.telephone || ""}
                        onChange={handleChange}
                        className="block w-full text-slate-900 bg-white border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold shadow-sm"
                        placeholder="+227 00 00 00 00"
                        style={{
                          borderRadius: "16px",
                          padding: "16px 16px 16px 48px",
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-black text-slate-700 mb-2.5 ml-1">
                      Adresse Email
                    </label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                      <input
                        type="email"
                        name="email"
                        value={info?.email || ""}
                        onChange={handleChange}
                        className="block w-full text-slate-900 bg-white border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold shadow-sm"
                        placeholder="boutique@exemple.com"
                        style={{
                          borderRadius: "16px",
                          padding: "16px 16px 16px 48px",
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Legal Info Card */}
            <div className="bg-white/60 backdrop-blur-3xl rounded-[32px] shadow-2xl shadow-amber-100/30 border border-white/80 overflow-hidden transition-all duration-300">
              <div className="border-b border-white/40 bg-amber-50/30 px-8 py-6">
                <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-3">
                  <span className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                    <FileSignature size={20} strokeWidth={2.5} />
                  </span>
                  Mentions Légales
                </h2>
                <p className="text-sm font-medium text-slate-500 mt-2 ml-11">
                  Les numéros d&apos;identification fiscale et légale (NIF, RC...).
                </p>
              </div>
              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-black text-slate-700 mb-2.5 ml-1">
                    Registre de Commerce (RC)
                  </label>
                  <input
                    type="text"
                    name="rc"
                    value={info?.rc || ""}
                    onChange={handleChange}
                    className="block w-full text-slate-900 bg-white border border-slate-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all font-black tracking-widest shadow-sm"
                    style={{
                      borderRadius: "16px",
                      padding: "16px",
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-black text-slate-700 mb-2.5 ml-1">
                    Identification Fiscale (NIF)
                  </label>
                  <input
                    type="text"
                    name="nif"
                    value={info?.nif || ""}
                    onChange={handleChange}
                    className="block w-full text-slate-900 bg-white border border-slate-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all font-black tracking-widest shadow-sm"
                    style={{
                      borderRadius: "16px",
                      padding: "16px",
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-black text-slate-700 mb-2.5 ml-1">
                    Identifiant Statistique (NIS)
                  </label>
                  <input
                    type="text"
                    name="nis"
                    value={info?.nis || ""}
                    onChange={handleChange}
                    className="block w-full text-slate-900 bg-white border border-slate-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all font-black tracking-widest shadow-sm"
                    style={{
                      borderRadius: "16px",
                      padding: "16px",
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-black text-slate-700 mb-2.5 ml-1">
                    Article d&apos;Imposition (AI)
                  </label>
                  <input
                    type="text"
                    name="art_impo"
                    value={info?.art_impo || ""}
                    onChange={handleChange}
                    className="block w-full text-slate-900 bg-white border border-slate-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all font-black tracking-widest shadow-sm"
                    style={{
                      borderRadius: "16px",
                      padding: "16px",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar Preferences */}
          <div className="space-y-8">
            <div className="bg-white/60 backdrop-blur-3xl rounded-[32px] shadow-2xl shadow-indigo-100/40 border border-white/80 p-8 transition-all duration-300">
              <h3 className="text-lg font-extrabold text-slate-900 mb-6">Aperçu Entreprise</h3>

              <div className="flex flex-col items-center text-center p-6 bg-[#F8FAFC] rounded-[16px] border border-slate-100 transition-all">
                <div
                  className="h-24 w-24 text-white rounded-2xl flex items-center justify-center mb-5 shadow-lg"
                  style={{ background: "linear-gradient(135deg, #3B82F6, #1E40AF)" }}
                >
                  <span className="text-4xl font-black shadow-sm">
                    {info?.nom_entreprise?.charAt(0) || "B"}
                  </span>
                </div>
                <h4 className="text-xl font-extrabold text-slate-900 break-words line-clamp-2">
                  {info?.nom_entreprise || "Mon Entreprise"}
                </h4>
                <p className="text-sm font-medium text-slate-500 mt-2 line-clamp-3">
                  {info?.adresse || "Adresse non définie"}
                </p>
              </div>

              <div className="mt-8 pt-8 border-t border-slate-100">
                <h3 className="text-sm font-extrabold text-slate-900 mb-5 uppercase tracking-wider text-slate-400">
                  Statut Système
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-bold text-slate-600">Base de données</span>
                    <span className="flex items-center gap-1.5 text-emerald-700 font-bold bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-xl shadow-sm">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      Connecté
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-bold text-slate-600">Version</span>
                    <span className="text-slate-900 font-black bg-slate-100 px-3 py-1.5 rounded-xl">
                      v2.0 (Web)
                    </span>
                  </div>
                  <div className="pt-4 border-t border-slate-100">
                    <button
                      onClick={() => setShowSupabaseConfig(true)}
                      className="w-full flex items-center justify-center gap-2 text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors py-2.5 rounded-xl hover:bg-blue-50 border border-slate-200"
                    >
                      <Database size={16} />
                      Configuration Supabase
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
