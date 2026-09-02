"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/lib/i18n/context";

export default function RegisterPage() {
  const router = useRouter();
  const { t, dir } = useLanguage();
  const [orgName, setOrgName] = useState("");
  const [country, setCountry] = useState("Niger");
  const [currency, setCurrency] = useState("FCFA");
  const [adminUsername, setAdminUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/register-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName,
          country,
          currency,
          adminUsername,
          password,
          email,
          phone,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Une erreur est survenue lors de l'inscription.");
      }

      // Save cookie fallback for client
      if (data.session) {
        document.cookie = `gp_session=${encodeURIComponent(JSON.stringify(data.session))}; path=/; max-age=86400; SameSite=Lax`;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Erreur de connexion.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir={dir} style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at top, #1e293b 0%, #0f172a 50%, #020617 100%)",
      color: "#f8fafc",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 16px",
      fontFamily: "system-ui, -apple-system, sans-serif"
    }}>
      {/* Top Bar Switcher */}
      <div style={{ position: "absolute", top: 20, right: 20, zIndex: 10 }}>
        <LanguageSwitcher variant="dark" />
      </div>

      {/* Background Glow */}
      <div style={{
        position: "absolute",
        top: "20%",
        width: "500px",
        height: "500px",
        background: "radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)",
        pointerEvents: "none"
      }} />

      {/* Main Container */}
      <div style={{
        width: "100%",
        maxWidth: "540px",
        background: "rgba(30, 41, 59, 0.75)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: "20px",
        padding: "36px 32px",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        zIndex: 1
      }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{
            width: "56px",
            height: "56px",
            background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
            borderRadius: "16px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "14px",
            boxShadow: "0 10px 20px rgba(59, 130, 246, 0.3)"
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <h1 style={{ fontSize: "24px", fontWeight: "700", margin: "0 0 6px 0", color: "#ffffff" }}>
            Créer votre Espace Entreprise
          </h1>
          <p style={{ fontSize: "14px", color: "#94a3b8", margin: 0 }}>
            Essai gratuit de 14 jours • Aucune carte requise
          </p>
        </div>

        {/* Feature Badges */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          gap: "8px",
          marginBottom: "24px",
          flexWrap: "wrap"
        }}>
          <span style={{ fontSize: "12px", background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa", padding: "4px 10px", borderRadius: "20px", border: "1px solid rgba(59, 130, 246, 0.3)" }}>
            ⚡ Prêt en 10 secondes
          </span>
          <span style={{ fontSize: "12px", background: "rgba(16, 185, 129, 0.15)", color: "#34d399", padding: "4px 10px", borderRadius: "20px", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
            🛡️ Données isolées & sécurisées
          </span>
          <span style={{ fontSize: "12px", background: "rgba(168, 85, 247, 0.15)", color: "#c084fc", padding: "4px 10px", borderRadius: "20px", border: "1px solid rgba(168, 85, 247, 0.3)" }}>
            🌍 Multi-devises
          </span>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            color: "#fca5a5",
            padding: "12px 16px",
            borderRadius: "10px",
            marginBottom: "20px",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "10px"
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Organization Name */}
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "500", color: "#cbd5e1", marginBottom: "6px" }}>
              Nom de l’Entreprise / Société *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Société Al-Baraka SARL"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              style={{
                width: "100%",
                padding: "11px 14px",
                background: "rgba(15, 23, 42, 0.6)",
                border: "1px solid #334155",
                borderRadius: "10px",
                color: "#f8fafc",
                fontSize: "14px",
                boxSizing: "border-box",
                outline: "none"
              }}
            />
          </div>

          {/* Country & Currency Row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "500", color: "#cbd5e1", marginBottom: "6px" }}>
                Pays *
              </label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  background: "rgba(15, 23, 42, 0.9)",
                  border: "1px solid #334155",
                  borderRadius: "10px",
                  color: "#f8fafc",
                  fontSize: "14px",
                  boxSizing: "border-box",
                  outline: "none"
                }}
              >
                <option value="Niger">Niger</option>
                <option value="Sénégal">Sénégal</option>
                <option value="Côte d'Ivoire">Côte d'Ivoire</option>
                <option value="Mali">Mali</option>
                <option value="Burkina Faso">Burkina Faso</option>
                <option value="Bénin">Bénin</option>
                <option value="Togo">Togo</option>
                <option value="Guinée">Guinée</option>
                <option value="France">France</option>
                <option value="Émirats Arabes Unis">Émirats Arabes Unis</option>
                <option value="Arabie Saoudite">Arabie Saoudite</option>
                <option value="Autre">Autre / International</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "500", color: "#cbd5e1", marginBottom: "6px" }}>
                Devise Principale *
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  background: "rgba(15, 23, 42, 0.9)",
                  border: "1px solid #334155",
                  borderRadius: "10px",
                  color: "#f8fafc",
                  fontSize: "14px",
                  boxSizing: "border-box",
                  outline: "none"
                }}
              >
                <option value="FCFA">FCFA (XOF / XAF)</option>
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
                <option value="NGN">NGN (₦)</option>
                <option value="SAR">SAR (ر.س)</option>
                <option value="AED">AED (د.إ)</option>
              </select>
            </div>
          </div>

          {/* Admin Username */}
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "500", color: "#cbd5e1", marginBottom: "6px" }}>
              Identifiant Administrateur (Login) *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: admin_albaraka"
              value={adminUsername}
              onChange={(e) => setAdminUsername(e.target.value)}
              style={{
                width: "100%",
                padding: "11px 14px",
                background: "rgba(15, 23, 42, 0.6)",
                border: "1px solid #334155",
                borderRadius: "10px",
                color: "#f8fafc",
                fontSize: "14px",
                boxSizing: "border-box",
                outline: "none"
              }}
            />
          </div>

          {/* Password */}
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "500", color: "#cbd5e1", marginBottom: "6px" }}>
              Mot de passe de connexion *
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: "100%",
                  padding: "11px 40px 11px 14px",
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid #334155",
                  borderRadius: "10px",
                  color: "#f8fafc",
                  fontSize: "14px",
                  boxSizing: "border-box",
                  outline: "none"
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer"
                }}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          {/* Email & Phone (Optional) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "500", color: "#cbd5e1", marginBottom: "6px" }}>
                Email (Optionnel)
              </label>
              <input
                type="email"
                placeholder="contact@entreprise.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid #334155",
                  borderRadius: "10px",
                  color: "#f8fafc",
                  fontSize: "14px",
                  boxSizing: "border-box",
                  outline: "none"
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "500", color: "#cbd5e1", marginBottom: "6px" }}>
                Téléphone (Optionnel)
              </label>
              <input
                type="tel"
                placeholder="+227 90 00 00 00"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid #334155",
                  borderRadius: "10px",
                  color: "#f8fafc",
                  fontSize: "14px",
                  boxSizing: "border-box",
                  outline: "none"
                }}
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: "10px",
              padding: "13px",
              background: "linear-gradient(135deg, #3b82f6, #2563eb)",
              color: "#ffffff",
              border: "none",
              borderRadius: "10px",
              fontSize: "15px",
              fontWeight: "600",
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: "0 4px 14px rgba(59, 130, 246, 0.4)",
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px"
            }}
          >
            {loading ? (
              <span>Création de votre espace en cours...</span>
            ) : (
              <>
                <span>Créer mon compte & Démarrer l'essai</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div style={{ marginTop: "24px", textAlign: "center", fontSize: "14px", color: "#94a3b8" }}>
          Vous avez déjà un compte ?{" "}
          <Link href="/login" style={{ color: "#60a5fa", textDecoration: "none", fontWeight: "600" }}>
            Se connecter
          </Link>
        </div>
      </div>
    </div>
  );
}
