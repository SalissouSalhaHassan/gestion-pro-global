"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/* ═══════════════════════════════════════════════════════════════
   ANIMATED PARTICLE BACKGROUND
   ═══════════════════════════════════════════════════════════════ */

function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);

    const particles: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      alpha: number;
    }[] = [];

    const COUNT = 80;
    const CONNECT_DIST = 140;

    for (let i = 0; i < COUNT; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        r: Math.random() * 2 + 1,
        alpha: Math.random() * 0.5 + 0.2,
      });
    }

    function draw() {
      ctx!.clearRect(0, 0, w, h);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
        ctx!.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECT_DIST) {
            ctx!.beginPath();
            ctx!.moveTo(p.x, p.y);
            ctx!.lineTo(q.x, q.y);
            ctx!.strokeStyle = `rgba(255, 255, 255, ${0.12 * (1 - dist / CONNECT_DIST)})`;
            ctx!.lineWidth = 0.6;
            ctx!.stroke();
          }
        }
      }

      animationId = requestAnimationFrame(draw);
    }

    draw();

    const handleResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 1,
      }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════
   LIVE CLOCK
   ═══════════════════════════════════════════════════════════════ */

function LiveClock() {
  const [time, setTime] = useState(new Date());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!mounted) {
    return (
      <div style={styles.clockBox}>
        <div style={styles.clockTime}>--:--:--</div>
        <div style={styles.clockDate}>Chargement...</div>
      </div>
    );
  }

  return (
    <div style={styles.clockBox}>
      <div style={styles.clockTime}>
        {time.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </div>
      <div style={styles.clockDate}>
        {time.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN LOGIN PAGE
   ═══════════════════════════════════════════════════════════════ */

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // --- CUSTOM AUTH LOGIC ---
    const identifier = email.trim();
    const { data: userRecord, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .eq("utilisateur", identifier)
      .eq("mot_de_passe", password)
      .maybeSingle();

    if (fetchError || !userRecord) {
      setError("L'identifiant ou le mot de passe est incorrect.");
      setLoading(false);
      return;
    }

    // Set custom session cookie (24 hours)
    const sessionData = {
      id: userRecord.id,
      username: userRecord.utilisateur,
      role: userRecord.role_id,
      admin: userRecord.admin,
      emplacement: userRecord.emplacement || "",
      depots: userRecord.depots || ""
    };
    document.cookie = `gp_session=${encodeURIComponent(JSON.stringify(sessionData))}; path=/; max-age=86400; SameSite=Lax`;

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.15); }
          50%      { box-shadow: 0 0 35px rgba(59, 130, 246, 0.3); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%      { transform: translateY(-6px); }
        }
        .login-input:focus {
          border-color: #3b82f6 !important;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15), 0 1px 2px rgba(0,0,0,0.05) !important;
        }
        .login-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 25px rgba(37, 99, 235, 0.4) !important;
        }
        .login-btn:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: 0 2px 10px rgba(37, 99, 235, 0.3) !important;
        }
        .login-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .toggle-pw:hover {
          color: #3b82f6 !important;
        }
        .forgot-link:hover {
          color: #60a5fa !important;
          text-decoration: underline !important;
        }
        .card-glass {
          animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards,
                     pulse-glow 4s ease-in-out infinite 1s;
        }
      `}</style>

      <div style={styles.root} dir="ltr">
        {/* Animated particle background */}
        <ParticleCanvas />

        {/* Gradient overlay for depth */}
        <div style={styles.overlay} />

        {/* Content */}
        <div style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          padding: 20,
        }}>

          {/* Live Clock */}
          <div style={{
            opacity: mounted ? 1 : 0,
            transition: "opacity 0.6s ease",
            marginBottom: 28,
            animation: mounted ? "fadeIn 1s ease" : "none",
          }}>
            <LiveClock />
          </div>

          {/* Login Card */}
          <div
            className="card-glass"
            style={{
              ...styles.card,
              opacity: mounted ? 1 : 0,
            }}
          >
            {/* Logo / Brand */}
            <div style={styles.brandSection}>
              <div style={{
                ...styles.logoCircle,
                animation: "float 3s ease-in-out infinite",
              }}>
                {/* Store/Business Icon */}
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <h1 style={styles.brandTitle}>GestionPro</h1>
              <p style={styles.brandSubtitle}>Système de Gestion Commerciale</p>
            </div>

            {/* Divider */}
            <div style={styles.divider}>
              <div style={styles.dividerLine} />
              <span style={styles.dividerText}>Connexion sécurisée</span>
              <div style={styles.dividerLine} />
            </div>

            {/* Error */}
            {error && (
              <div style={styles.errorBox}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Email Field */}
              <div style={styles.fieldGroup}>
                <label style={styles.label} htmlFor="login-email">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Identifiant ou E-mail
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    className="login-input"
                    id="login-email"
                    type="text"
                    placeholder="votre_identifiant"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocusedField("email")}
                    onBlur={() => setFocusedField(null)}
                    required
                    autoComplete="username"
                    style={{
                      ...styles.input,
                      borderColor: focusedField === "email" ? "#3b82f6" : "#e2e8f0",
                    }}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div style={styles.fieldGroup}>
                <label style={styles.label} htmlFor="login-password">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Mot de passe
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    className="login-input"
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField(null)}
                    required
                    autoComplete="current-password"
                    style={{
                      ...styles.input,
                      paddingRight: 44,
                      borderColor: focusedField === "password" ? "#3b82f6" : "#e2e8f0",
                    }}
                  />
                  <button
                    type="button"
                    className="toggle-pw"
                    onClick={() => setShowPassword(!showPassword)}
                    style={styles.togglePw}
                    tabIndex={-1}
                    aria-label={showPassword ? "Masquer" : "Afficher"}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Remember / Forgot row */}
              <div style={styles.optionsRow}>
                <label style={styles.rememberLabel}>
                  <input type="checkbox" style={styles.checkbox} />
                  <span>Se souvenir de moi</span>
                </label>
                <a href="#" className="forgot-link" style={styles.forgotLink}>
                  Mot de passe oublié ?
                </a>
              </div>

              {/* Submit Button */}
              <button
                className="login-btn"
                type="submit"
                disabled={loading}
                style={styles.submitBtn}
              >
                {loading ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={styles.spinner} />
                    <span>Connexion en cours...</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                      <polyline points="10 17 15 12 10 7" />
                      <line x1="15" y1="12" x2="3" y2="12" />
                    </svg>
                    <span>Se connecter</span>
                  </div>
                )}
              </button>
            </form>

            {/* Footer */}
            <div style={styles.cardFooter}>
              <div style={styles.securityBadge}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span>Connexion chiffrée SSL</span>
              </div>
            </div>
          </div>

          {/* Bottom branding */}
          <div style={{
            marginTop: 24,
            textAlign: "center",
            opacity: mounted ? 1 : 0,
            transition: "opacity 0.8s ease 0.5s",
          }}>
            <p style={styles.copyright}>
              © {new Date().getFullYear()} GestionPro — Tous droits réservés
            </p>
            <p style={styles.version}>
              Version 2.0 • Web Edition
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════ */

const styles = {
  root: {
    position: "relative" as const,
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 30%, #1a2744 50%, #0c1929 100%)",
    fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif",
    overflow: "hidden",
  },
  overlay: {
    position: "absolute" as const,
    inset: 0,
    background: "radial-gradient(ellipse at 30% 20%, rgba(59, 130, 246, 0.12) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(16, 185, 129, 0.08) 0%, transparent 50%)",
    zIndex: 2,
  },

  // Clock
  clockBox: {
    textAlign: "center" as const,
    color: "#fff",
  },
  clockTime: {
    fontSize: 42,
    fontWeight: 200,
    letterSpacing: 4,
    color: "rgba(255, 255, 255, 0.9)",
    textShadow: "0 2px 10px rgba(0,0,0,0.3)",
  },
  clockDate: {
    fontSize: 14,
    fontWeight: 400,
    color: "rgba(255, 255, 255, 0.5)",
    letterSpacing: 1,
    textTransform: "capitalize" as const,
    marginTop: 4,
  },

  // Card
  card: {
    width: "100%",
    maxWidth: 420,
    background: "rgba(255, 255, 255, 0.97)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    borderRadius: 20,
    padding: "36px 32px 28px",
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)",
  },

  // Brand
  brandSection: {
    textAlign: "center" as const,
    marginBottom: 24,
  },
  logoCircle: {
    width: 60,
    height: 60,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #1e40af 100%)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    boxShadow: "0 4px 15px rgba(37, 99, 235, 0.35)",
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: 800,
    color: "#0f172a",
    letterSpacing: -0.5,
    margin: 0,
    lineHeight: 1.2,
  },
  brandSubtitle: {
    fontSize: 13,
    fontWeight: 500,
    color: "#94a3b8",
    marginTop: 4,
    letterSpacing: 0.3,
  },

  // Divider
  divider: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 22,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    background: "linear-gradient(90deg, transparent, #e2e8f0, transparent)",
  },
  dividerText: {
    fontSize: 11,
    fontWeight: 600,
    color: "#94a3b8",
    textTransform: "uppercase" as const,
    letterSpacing: 1.5,
    whiteSpace: "nowrap" as const,
  },

  // Error
  errorBox: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 500,
    color: "#dc2626",
    marginBottom: 8,
    animation: "fadeInUp 0.3s ease",
  },

  // Fields
  fieldGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: "#475569",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    border: "2px solid #e2e8f0",
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 500,
    color: "#0f172a",
    background: "#f8fafc",
    outline: "none",
    transition: "all 0.2s ease",
    boxSizing: "border-box" as const,
  },
  togglePw: {
    position: "absolute" as const,
    right: 12,
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#94a3b8",
    padding: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "color 0.2s",
  },

  // Options row
  optionsRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: -4,
  },
  rememberLabel: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 13,
    fontWeight: 500,
    color: "#64748b",
    cursor: "pointer",
  },
  checkbox: {
    width: 16,
    height: 16,
    accentColor: "#2563eb",
    cursor: "pointer",
    borderRadius: 4,
  },
  forgotLink: {
    fontSize: 13,
    fontWeight: 600,
    color: "#3b82f6",
    textDecoration: "none",
    transition: "color 0.2s",
  },

  // Submit
  submitBtn: {
    width: "100%",
    padding: "14px 0",
    border: "none",
    borderRadius: 12,
    background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #1e40af 100%)",
    color: "#fff",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
    boxShadow: "0 4px 15px rgba(37, 99, 235, 0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    letterSpacing: 0.3,
    marginTop: 4,
  },
  spinner: {
    width: 18,
    height: 18,
    border: "2.5px solid rgba(255,255,255,0.3)",
    borderTop: "2.5px solid #fff",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },

  // Footer
  cardFooter: {
    marginTop: 20,
    textAlign: "center" as const,
  },
  securityBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontSize: 11,
    fontWeight: 600,
    color: "#10b981",
    background: "#ecfdf5",
    padding: "5px 12px",
    borderRadius: 20,
    letterSpacing: 0.3,
  },

  // Bottom
  copyright: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.4)",
    margin: 0,
    fontWeight: 400,
  },
  version: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.25)",
    margin: 0,
    marginTop: 4,
    fontWeight: 400,
  },
};
