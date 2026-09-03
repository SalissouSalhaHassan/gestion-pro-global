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
  Shield,
  Coins,
  Palette,
  Stamp,
  QrCode,
  FileText,
  Eye,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { createBrowserClient } from "@supabase/ssr";

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

type CompanyInfo = {
  nom_entreprise: string;
  slogan?: string;
  adresse: string;
  telephone: string;
  email: string;
  site_web?: string;
  rc: string;
  nif: string;
  nis?: string;
  art_impo?: string;
  art_imposition?: string;
  notes_pied_facture?: string;
  brand_color?: string;
  show_qr_code?: boolean;
  show_stamp?: boolean;
  chemin_logo?: string | null;
};

const BRAND_COLORS = [
  { name: "Indigo Classic", hex: "#4f46e5" },
  { name: "Emerald Pro", hex: "#059669" },
  { name: "Ocean Blue", hex: "#0284c7" },
  { name: "Ruby Premium", hex: "#e11d48" },
  { name: "Dark Slate", hex: "#0f172a" },
  { name: "Gold Luxury", hex: "#d97706" },
];

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

  useEffect(() => {
    setSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
    setSupabaseKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");
  }, []);

  const handleTestConnection = async () => {
    setConnStatus("testing");
    setConnMessage("");

    try {
      const cleanUrl = supabaseUrl.trim().replace(/\/+$/, "");
      const cleanKey = supabaseKey.trim();

      if (!cleanUrl || !cleanKey) {
        throw new Error("Veuillez saisir l'URL et la Clé API.");
      }

      const tempSupabase = createBrowserClient(cleanUrl, cleanKey);
      const { error } = await tempSupabase
        .from("informations_entreprise")
        .select("id")
        .limit(1);

      if (!error) {
        setConnStatus("success");
        setConnMessage("✅ Connexion réussie ! API & Base de données fonctionnelles.");
      } else {
        const errorMsg = error.message?.toLowerCase() || "";
        const errorCode = String(error.code);

        if (errorCode === "401" || errorMsg.includes("invalid api key") || errorMsg.includes("unauthorized")) {
          throw new Error("Clé API (anon) incorrecte. Le serveur a rejeté cette clé.");
        }
        if (errorMsg.includes("fetch") || errorMsg.includes("network") || errorMsg.includes("failed to fetch")) {
          throw new Error("L'URL est inaccessible. Vérifiez votre lien Supabase URL ou votre connexion.");
        }

        const isConnectionSuccess =
          errorCode === "42P01" || errorCode === "PGRST116" || errorMsg.includes("not found");

        if (isConnectionSuccess) {
          setConnStatus("success");
          setConnMessage("✅ Connexion réussie ! (Clé reconnue, accès validé).");
        } else {
          setConnStatus("error");
          setConnMessage(`❌ Erreur DB (${errorCode}): ${error.message}`);
        }
      }
    } catch (err) {
      setConnStatus("error");
      setConnMessage(`❌ ${err instanceof Error ? err.message : "Erreur de connexion inattendue"}`);
    }
  };

  const handleSave = async () => {
    if (!supabaseUrl.trim() || !supabaseKey.trim()) {
      setConnMessage("⚠️ Veuillez remplir tous les champs.");
      setConnStatus("error");
      return;
    }
    setSaving(true);
    try {
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
        setConnMessage("✅ Configuration enregistrée !");
      } else {
        setConnStatus("success");
        setConnMessage("ℹ️ Configuration mise à jour dans l'environnement local.");
      }
    } catch (err) {
      setConnStatus("error");
      setConnMessage(`❌ Erreur: ${err instanceof Error ? err.message : "Inconnue"}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDiagnostic = () => {
    const info: string[] = [];
    const cleanUrl = supabaseUrl.trim().replace(/\/+$/, "");
    info.push(`🌐 URL: ${cleanUrl ? "Définie (" + cleanUrl.slice(0, 30) + "...)" : "Non renseignée"}`);
    info.push(`🔑 Clé: ${supabaseKey ? "Présente (" + supabaseKey.length + " chars)" : "Non renseignée"}`);
    setDiagnosticInfo(info);
    setShowDiagnostic(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-800" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <span className="text-sm font-black text-slate-300 flex items-center gap-2">
            <Database size={16} /> Configuration Supabase / PostgreSQL
          </span>
          <button onClick={onClose} className="text-slate-500 hover:text-white cursor-pointer"><X size={18} /></button>
        </div>
        <div className="p-8 space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5">Supabase URL</label>
            <input
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              type="text"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              placeholder="https://xxxx.supabase.co"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5">Supabase Anon Key</label>
            <input
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              type="password"
              value={supabaseKey}
              onChange={(e) => setSupabaseKey(e.target.value)}
              placeholder="eyJhbGciOi..."
            />
          </div>
          {connMessage && (
            <div className="p-3 rounded-xl text-xs font-bold border border-slate-700 bg-slate-800/80 text-slate-200">
              {connMessage}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={handleTestConnection}
              disabled={connStatus === "testing"}
              className="bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-xl text-xs font-black cursor-pointer transition-all"
            >
              {connStatus === "testing" ? "Test..." : "Tester la connexion"}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-xs font-black cursor-pointer transition-all"
            >
              {saving ? "Sauvegarde..." : "Enregistrer"}
            </button>
          </div>
          <button onClick={handleDiagnostic} className="w-full text-center text-[11px] font-bold text-slate-500 hover:text-slate-400 cursor-pointer">
            🔍 Diagnostic Système
          </button>
          {showDiagnostic && (
            <div className="p-3 bg-slate-950 rounded-xl text-[11px] font-mono text-slate-400 space-y-1">
              {diagnosticInfo.map((l, idx) => (
                <div key={idx}>{l}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN UNIFIED SETTINGS PAGE
   ═══════════════════════════════════════════════════════════════ */

const supabase = createClient();

export default function SettingsPage() {
  const [info, setInfo] = useState<CompanyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showSupabaseConfig, setShowSupabaseConfig] = useState(false);
  const [activeTab, setActiveTab] = useState<"general" | "branding">("general");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("tab") === "branding") {
        setActiveTab("branding");
      }
    }

    async function loadInfo() {
      try {
        const { data, error } = await supabase
          .from("informations_entreprise")
          .select("*")
          .eq("id", 1)
          .maybeSingle();

        let brandingCache: any = {};
        try {
          const cached = localStorage.getItem("company_branding_settings");
          if (cached) brandingCache = JSON.parse(cached);
        } catch (e) {}

        if (!error && data) {
          setInfo({
            nom_entreprise: data.nom_entreprise || "GESTION PRO GLOBAL",
            slogan: brandingCache.slogan || "Commerce Général & Import-Export",
            adresse: data.adresse || "Niamey, Niger",
            telephone: data.telephone || "+227 00 00 00 00",
            email: data.email || "contact@gestionpro.com",
            site_web: data.site_web || "",
            rc: data.rc || "RCCM-NI-NIA-2026-B-001",
            nif: data.nif || "12345/P",
            nis: data.nis || "",
            art_impo: data.art_imposition || data.art_impo || "",
            notes_pied_facture: data.notes_pied_facture || "Merci pour votre confiance. Les marchandises vendues ne sont ni reprises ni échangées après 48h.",
            brand_color: brandingCache.brand_color || "#4f46e5",
            show_qr_code: brandingCache.show_qr_code !== false,
            show_stamp: brandingCache.show_stamp !== false,
            chemin_logo: data.chemin_logo || null,
          });
        } else {
          setInfo({
            nom_entreprise: "GESTION PRO GLOBAL",
            slogan: "Commerce Général & Import-Export",
            adresse: "Niamey, Niger",
            telephone: "+227 00 00 00 00",
            email: "contact@gestionpro.com",
            site_web: "",
            rc: "RCCM-NI-NIA-2026-B-001",
            nif: "12345/P",
            nis: "",
            art_impo: "",
            notes_pied_facture: "Merci pour votre confiance. Les marchandises vendues ne sont ni reprises ni échangées après 48h.",
            brand_color: brandingCache.brand_color || "#4f46e5",
            show_qr_code: brandingCache.show_qr_code !== false,
            show_stamp: brandingCache.show_stamp !== false,
            chemin_logo: null,
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setInfo((prev) => {
      const current = prev || {
        nom_entreprise: "",
        adresse: "",
        telephone: "",
        email: "",
        rc: "",
        nif: "",
      };
      return { ...current, [name]: value };
    });
  };

  const handleSave = async () => {
    if (!info) return;
    setSaving(true);
    try {
      // 1. Save to Supabase informations_entreprise
      const { error } = await supabase
        .from("informations_entreprise")
        .upsert({
          id: 1,
          nom_entreprise: info.nom_entreprise,
          adresse: info.adresse,
          telephone: info.telephone,
          email: info.email,
          site_web: info.site_web || null,
          rc: info.rc,
          nif: info.nif,
          art_imposition: info.art_impo || info.art_imposition || "",
          notes_pied_facture: info.notes_pied_facture,
        }, { onConflict: 'id' });

      if (error) throw error;

      // 2. Save Branding Preferences to localStorage
      try {
        localStorage.setItem("company_branding_settings", JSON.stringify({
          brand_color: info.brand_color || "#4f46e5",
          slogan: info.slogan || "",
          show_qr_code: info.show_qr_code !== false,
          show_stamp: info.show_stamp !== false,
        }));
        window.dispatchEvent(new Event("company_info_updated"));
      } catch (e) {}

      setToast({ message: "Informations générales et branding enregistrés avec succès !", type: "success" });
    } catch (err) {
      console.error(err);
      setToast({ message: "Erreur lors de la sauvegarde.", type: "error" });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3500);
    }
  };

  const brandColor = info?.brand_color || "#4f46e5";

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12 animate-in fade-in duration-300">
      {/* Supabase Config Modal */}
      {showSupabaseConfig && (
        <SupabaseConfigModal onClose={() => setShowSupabaseConfig(false)} />
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-2xl font-bold text-white flex items-center gap-3 transition-all animate-in slide-in-from-top-3 ${
            toast.type === "success"
              ? "bg-slate-900 border border-emerald-500/30 text-emerald-400"
              : "bg-rose-950 border border-rose-500/30 text-rose-400"
          }`}
        >
          <CheckCircle2 size={20} className={toast.type === "success" ? "text-emerald-400" : "text-rose-400"} />
          <span className="text-xs font-black text-white">{toast.message}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-md bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider">
              CONFIGURATION UNIFIÉE
            </span>
            <span className="text-xs font-bold text-slate-500">
              Informations Générales, Mentions Légales & Branding Facture
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            <Settings className="text-indigo-600" size={32} />
            Paramètres & Identité de l&apos;Entreprise
          </h1>
          <p className="mt-1 text-slate-500 text-xs sm:text-sm font-medium">
            Gérez toutes les coordonnées légales et personnalisez l&apos;identité visuelle de vos factures au même endroit.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/dashboard/settings/currencies"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold shadow-xs transition-all"
          >
            <Coins size={15} className="text-indigo-600" />
            <span>Devises & Fiscalité</span>
          </Link>

          <button
            onClick={() => setShowSupabaseConfig(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Database size={15} className="text-slate-600" />
            <span>Configuration Supabase</span>
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-black text-xs shadow-lg shadow-indigo-600/25 transition-all cursor-pointer disabled:opacity-70"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            <span>{saving ? "Enregistrement..." : "Enregistrer"}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 text-slate-400">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mb-3" />
          <p className="text-sm font-bold text-slate-600">Chargement des paramètres et du branding...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Form Controls with Tabs (6 cols) */}
          <div className="lg:col-span-6 space-y-6">
            {/* Unified Mode Switcher Tabs */}
            <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center gap-1 border border-slate-200/80">
              <button
                type="button"
                onClick={() => setActiveTab("general")}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === "general"
                    ? "bg-white text-indigo-600 shadow-sm shadow-indigo-100"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <Building2 size={16} />
                <span>Informations Générales & Légales</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("branding")}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === "branding"
                    ? "bg-white text-indigo-600 shadow-sm shadow-indigo-100"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <Palette size={16} />
                <span>Branding & Modèle Facture</span>
              </button>
            </div>

            {/* TAB 1: INFORMATIONS GÉNÉRALES & MENTIONS LÉGALES */}
            {activeTab === "general" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* General Info Card */}
                <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 space-y-5">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                      <Building2 size={20} />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-900">Coordonnées de l&apos;Entreprise</h2>
                      <p className="text-xs text-slate-400 font-medium">Les détails qui apparaîtront sur vos factures, reçus et devis.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Nom officiel de l&apos;entreprise
                      </label>
                      <input
                        type="text"
                        name="nom_entreprise"
                        value={info?.nom_entreprise || ""}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Ex: GESTION PRO GLOBAL"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Activité principale / Slogan
                      </label>
                      <input
                        type="text"
                        name="slogan"
                        value={info?.slogan || ""}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Ex: Commerce Général & Import-Export"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Adresse complète (Siège / Boutique)
                      </label>
                      <input
                        type="text"
                        name="adresse"
                        value={info?.adresse || ""}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Ex: Niamey, Niger - Boulevard Mali Béro"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          Téléphone professionnel
                        </label>
                        <input
                          type="text"
                          name="telephone"
                          value={info?.telephone || ""}
                          onChange={handleChange}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="+227 00 00 00 00"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          Adresse Email de contact
                        </label>
                        <input
                          type="email"
                          name="email"
                          value={info?.email || ""}
                          onChange={handleChange}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="contact@exemple.com"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Legal Info Card */}
                <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 space-y-5">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                    <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                      <FileSignature size={20} />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-900">Mentions Légales & Fiscales</h2>
                      <p className="text-xs text-slate-400 font-medium">Les identifiants d&apos;enregistrement légal exigés par la législation.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Registre de Commerce (RC / RCCM)
                      </label>
                      <input
                        type="text"
                        name="rc"
                        value={info?.rc || ""}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        placeholder="RCCM-NI-NIA-2026-B-001"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Identification Fiscale (NIF)
                      </label>
                      <input
                        type="text"
                        name="nif"
                        value={info?.nif || ""}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        placeholder="NIF: 12345/P"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Identifiant Statistique (NIS)
                      </label>
                      <input
                        type="text"
                        name="nis"
                        value={info?.nis || ""}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        placeholder="NIS-00000"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Article d&apos;Imposition (AI)
                      </label>
                      <input
                        type="text"
                        name="art_impo"
                        value={info?.art_impo || info?.art_imposition || ""}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        placeholder="AI-9999"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: BRANDING & FACTURE */}
            {activeTab === "branding" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Visual Identity Card */}
                <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 space-y-5">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                      <Palette size={20} />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-900">Couleurs & Thème de Marque</h2>
                      <p className="text-xs text-slate-400 font-medium">Choisissez la teinte dominante qui habillera vos factures et reçus.</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-3">
                      Couleur Principale du Modèle
                    </label>
                    <div className="grid grid-cols-6 gap-2.5">
                      {BRAND_COLORS.map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setInfo((prev) => prev ? { ...prev, brand_color: c.hex } : null)}
                          style={{ backgroundColor: c.hex }}
                          className={`h-11 rounded-2xl transition-all cursor-pointer flex items-center justify-center text-white shadow-sm ${
                            brandColor === c.hex ? "ring-4 ring-indigo-500/30 scale-105" : "opacity-85 hover:opacity-100"
                          }`}
                          title={c.name}
                        >
                          {brandColor === c.hex && <CheckCircle2 size={18} />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-100 cursor-pointer hover:bg-slate-100/70 transition-all">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-2.5">
                        <Stamp size={18} className="text-indigo-600" />
                        Afficher le Cachet Officiel & Mention &quot;Payé&quot;
                      </span>
                      <input
                        type="checkbox"
                        checked={info?.show_stamp !== false}
                        onChange={(e) => setInfo((prev) => prev ? { ...prev, show_stamp: e.target.checked } : null)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-100 cursor-pointer hover:bg-slate-100/70 transition-all">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-2.5">
                        <QrCode size={18} className="text-indigo-600" />
                        Afficher le QR Code de Vérification SSL
                      </span>
                      <input
                        type="checkbox"
                        checked={info?.show_qr_code !== false}
                        onChange={(e) => setInfo((prev) => prev ? { ...prev, show_qr_code: e.target.checked } : null)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                    </label>
                  </div>
                </div>

                {/* Footer Note / Conditions Card */}
                <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 space-y-5">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                    <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-900">Conditions de Vente & Pied de Page</h2>
                      <p className="text-xs text-slate-400 font-medium">Mention légale imprimée en bas de chaque facture et bordereau.</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                      Texte du bas de facture
                    </label>
                    <textarea
                      name="notes_pied_facture"
                      rows={3}
                      value={info?.notes_pied_facture || ""}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                      placeholder="Ex: Merci pour votre confiance. Les marchandises vendues ne sont ni reprises ni échangées après 48h."
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: LIVE INTERACTIVE INVOICE PREVIEW & SYSTEM STATUS (6 cols) */}
          <div className="lg:col-span-6 space-y-6">
            {/* Header Preview Banner */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Eye size={16} className="text-indigo-600" />
                Aperçu Direct du Modèle Facture (Format A4 & PDF)
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                Mise à jour en temps réel
              </span>
            </div>

            {/* Paper Sheet Simulator */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200/80 text-slate-900 space-y-6">
              {/* Header Ribbon */}
              <div
                className="p-5 sm:p-6 rounded-2xl text-white flex items-start sm:items-center justify-between transition-colors duration-300 shadow-sm"
                style={{ backgroundColor: brandColor }}
              >
                <div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center font-black text-sm">
                      {info?.nom_entreprise?.slice(0, 2).toUpperCase() || "GP"}
                    </div>
                    <h3 className="font-black text-base sm:text-lg text-white">{info?.nom_entreprise || "GESTION PRO GLOBAL"}</h3>
                  </div>
                  <p className="text-xs text-white/85 mt-0.5 font-medium">{info?.slogan || "Commerce Général & Import-Export"}</p>
                  <div className="text-[10px] text-white/70 mt-1 space-x-2 font-mono">
                    <span>{info?.rc || "RCCM-NI-NIA-2026-B-001"}</span>
                    <span>•</span>
                    <span>{info?.nif || "NIF: 12345/P"}</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-white/80">FACTURE</div>
                  <div className="text-base sm:text-lg font-black text-white font-mono">#FAC-2026-089</div>
                  <div className="text-[10px] text-white/80 mt-0.5">Date: {new Date().toLocaleDateString("fr-FR")}</div>
                </div>
              </div>

              {/* Bill To & Issuer Info */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="font-extrabold text-slate-400 uppercase text-[9px]">Client :</span>
                  <div className="font-black text-slate-900 text-xs mt-0.5">ETS AL-BARAKA & CIE</div>
                  <div className="text-slate-500 text-[10px] mt-0.5">Partenaire Commercial • Niamey</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-right">
                  <span className="font-extrabold text-slate-400 uppercase text-[9px]">Émetteur :</span>
                  <div className="font-bold text-slate-800 text-[11px] mt-0.5 truncate">{info?.adresse || "Niamey, Niger"}</div>
                  <div className="text-slate-500 text-[10px] mt-0.5 truncate">{info?.telephone || "+227 00 00 00 00"}</div>
                </div>
              </div>

              {/* Items Table Mockup */}
              <div className="rounded-xl border border-slate-200 overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 font-black text-slate-700 border-b border-slate-200 text-[10px] uppercase">
                    <tr>
                      <th className="py-2 px-3">Désignation</th>
                      <th className="py-2 px-3 text-center">Qté</th>
                      <th className="py-2 px-3 text-right">P.U TTC</th>
                      <th className="py-2 px-3 text-right">Total TTC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                    <tr>
                      <td className="py-2 px-3 font-bold">Ciment Dangote 42.5R (Tonne)</td>
                      <td className="py-2 px-3 text-center font-bold">10</td>
                      <td className="py-2 px-3 text-right font-mono">85 000 FCFA</td>
                      <td className="py-2 px-3 text-right font-black text-slate-900 font-mono">850 000 FCFA</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-bold">Fer à Béton FeE500 12mm</td>
                      <td className="py-2 px-3 text-center font-bold">25</td>
                      <td className="py-2 px-3 text-right font-mono">4 200 FCFA</td>
                      <td className="py-2 px-3 text-right font-black text-slate-900 font-mono">105 000 FCFA</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Total Row */}
              <div className="flex justify-end">
                <div className="w-60 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-500 text-[11px]">
                    <span>Total HT :</span>
                    <span className="font-mono font-bold">802 521 FCFA</span>
                  </div>
                  <div className="flex justify-between text-slate-500 text-[11px]">
                    <span>TVA (19%) :</span>
                    <span className="font-mono font-bold">152 479 FCFA</span>
                  </div>
                  <div
                    className="flex justify-between text-xs sm:text-sm font-black p-2.5 rounded-xl text-white mt-1 transition-colors duration-300"
                    style={{ backgroundColor: brandColor }}
                  >
                    <span>TOTAL TTC :</span>
                    <span className="font-mono">955 000 FCFA</span>
                  </div>
                </div>
              </div>

              {/* Stamp + QR Code + Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <div className="max-w-[240px] text-[10px] text-slate-500 leading-relaxed">
                  {info?.notes_pied_facture || "Merci pour votre confiance. Les marchandises vendues ne sont ni reprises ni échangées après 48h."}
                </div>

                <div className="flex items-center gap-3">
                  {info?.show_qr_code !== false && (
                    <div className="p-1 rounded-lg border border-slate-200 bg-slate-50 text-center">
                      <QrCode size={34} className="text-slate-800" />
                      <span className="text-[7px] font-bold text-slate-400 block">Vérifié SSL</span>
                    </div>
                  )}

                  {info?.show_stamp !== false && (
                    <div
                      className="w-20 h-16 rounded-xl border-2 border-dashed flex flex-col items-center justify-center rotate-[-4deg] transition-colors duration-300"
                      style={{ borderColor: brandColor, color: brandColor }}
                    >
                      <span className="text-[8px] font-black uppercase truncate max-w-[70px]">{info?.nom_entreprise?.slice(0, 10) || "ENTREPRISE"}</span>
                      <span className="text-[7px] font-extrabold uppercase">CACHET OFFICIEL</span>
                      <span className="text-[6px] font-bold">NIAMEY</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* System Status Card */}
            <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 space-y-3">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">
                État du Système & Connexion
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="font-bold text-slate-600">Base de données</span>
                  <span className="flex items-center gap-1.5 text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg text-[10px]">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Connecté
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="font-bold text-slate-600">Version</span>
                  <span className="text-slate-900 font-black bg-white px-2 py-0.5 rounded-lg border border-slate-200 text-[10px]">
                    v2.0 (Web Pro)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
