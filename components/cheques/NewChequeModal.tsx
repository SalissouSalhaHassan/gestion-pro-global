"use client";

import { useState, useEffect } from "react";
import {
  X,
  CreditCard,
  Building2,
  Calendar,
  DollarSign,
  User,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";

interface NewChequeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const COMMON_BANKS = [
  "SONIBANK",
  "BIA-Niger",
  "BOA (Bank of Africa)",
  "ECOBANK",
  "ORABANK",
  "BAGRI",
  "BSIC",
  "Banque Atlantique",
  "Coris Bank",
  "UBA",
  "CBAO",
  "Autre Banque"
];

export default function NewChequeModal({ isOpen, onClose, onSuccess }: NewChequeModalProps) {
  const { dir } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [typeOperation, setTypeOperation] = useState<"A_ENCAISSER" | "EMIS">("A_ENCAISSER");
  const [typeTitre, setTypeTitre] = useState<"CHEQUE" | "EFFET" | "BILLET_A_ORDRE">("CHEQUE");
  const [numeroPiece, setNumeroPiece] = useState("");
  const [banqueEmetteur, setBanqueEmetteur] = useState(COMMON_BANKS[0]);
  const [autreBanque, setAutreBanque] = useState("");
  const [emetteurNom, setEmetteurNom] = useState("");
  const [beneficiaireNom, setBeneficiaireNom] = useState("NOTRE ENTREPRISE");
  const [montant, setMontant] = useState("");
  const [dateEmission, setDateEmission] = useState(new Date().toISOString().slice(0, 10));
  const [dateEcheance, setDateEcheance] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  // Selectable Clients / Fournisseurs
  const [clients, setClients] = useState<any[]>([]);
  const [fournisseurs, setFournisseurs] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedFournisseurId, setSelectedFournisseurId] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      // Load clients and suppliers
      fetch("/api/clients")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setClients(data);
          else if (data.clients) setClients(data.clients);
        })
        .catch((e) => console.error("Could not fetch clients", e));

      fetch("/api/suppliers")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setFournisseurs(data);
          else if (data.suppliers) setFournisseurs(data.suppliers);
        })
        .catch((e) => console.error("Could not fetch suppliers", e));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleQuickDueDate = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setDateEcheance(d.toISOString().slice(0, 10));
  };

  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    const c = clients.find((item) => String(item.id) === String(clientId));
    if (c) {
      setEmetteurNom(c.nom);
    }
  };

  const handleFournisseurSelect = (fournisseurId: string) => {
    setSelectedFournisseurId(fournisseurId);
    const f = fournisseurs.find((item) => String(item.id) === String(fournisseurId));
    if (f) {
      setBeneficiaireNom(f.nom);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const finalBank = banqueEmetteur === "Autre Banque" ? autreBanque.trim() : banqueEmetteur;

    if (!numeroPiece.trim()) {
      setError("Veuillez saisir le numéro de chèque ou de pièce.");
      return;
    }
    if (!finalBank) {
      setError("Veuillez sélectionner ou préciser la banque.");
      return;
    }
    if (!montant || Number(montant) <= 0) {
      setError("Veuillez indiquer un montant valide supérieur à 0.");
      return;
    }
    if (!dateEcheance) {
      setError("La date d'échéance est obligatoire pour le suivi du radar.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/cheques", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type_operation: typeOperation,
          type_titre: typeTitre,
          numero_piece: numeroPiece.trim(),
          banque_emetteur: finalBank,
          emetteur_nom: emetteurNom.trim() || (typeOperation === "A_ENCAISSER" ? "Client" : "Notre Entreprise"),
          beneficiaire_nom: beneficiaireNom.trim() || (typeOperation === "A_ENCAISSER" ? "Notre Entreprise" : "Fournisseur"),
          montant: Number(montant),
          date_emission: dateEmission,
          date_echeance: dateEcheance,
          client_id: typeOperation === "A_ENCAISSER" && selectedClientId ? Number(selectedClientId) : null,
          fournisseur_id: typeOperation === "EMIS" && selectedFournisseurId ? Number(selectedFournisseurId) : null,
          notes: notes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'enregistrement");

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn" dir={dir}>
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-indigo-50/40 dark:from-slate-900 dark:to-indigo-950/20">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30">
              <CreditCard size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Nouveau Chèque / Effet de Commerce
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Enregistrez vos chèques reçus ou émis dans le coffre-fort et activez le radar d'échéances
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
          {error && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-2xl text-rose-700 dark:text-rose-300 text-sm flex items-center gap-2.5">
              <AlertCircle size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Operation Flow Switch */}
          <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-700/50">
            <button
              type="button"
              onClick={() => {
                setTypeOperation("A_ENCAISSER");
                setBeneficiaireNom("NOTRE ENTREPRISE");
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all ${
                typeOperation === "A_ENCAISSER"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/25"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <ArrowDownLeft size={17} />
              <span>À Encaisser (Chèque Client)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTypeOperation("EMIS");
                setEmetteurNom("NOTRE ENTREPRISE");
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all ${
                typeOperation === "EMIS"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <ArrowUpRight size={17} />
              <span>Émis (Fournisseur / Décaissement)</span>
            </button>
          </div>

          {/* Type of instrument */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Type de titre :</span>
            {(["CHEQUE", "EFFET", "BILLET_A_ORDRE"] as const).map((titre) => (
              <label
                key={titre}
                className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-xl border cursor-pointer transition-all ${
                  typeTitre === titre
                    ? "bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-700 dark:text-indigo-300 shadow-sm"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="typeTitre"
                  value={titre}
                  checked={typeTitre === titre}
                  onChange={() => setTypeTitre(titre)}
                  className="hidden"
                />
                <span>
                  {titre === "CHEQUE" && "Chèque Bancaire"}
                  {titre === "EFFET" && "Traite / Lettre de Change"}
                  {titre === "BILLET_A_ORDRE" && "Billet à Ordre"}
                </span>
              </label>
            ))}
          </div>

          {/* Core Info: Number, Bank, Amount */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                N° de Chèque / Pièce *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: CHQ-889421"
                value={numeroPiece}
                onChange={(e) => setNumeroPiece(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Banque *
              </label>
              <select
                value={banqueEmetteur}
                onChange={(e) => setBanqueEmetteur(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                {COMMON_BANKS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Montant (FCFA) *
              </label>
              <input
                type="number"
                step="any"
                required
                placeholder="Ex: 5000000"
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-bold text-indigo-600 dark:text-indigo-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {banqueEmetteur === "Autre Banque" && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Nom de la banque personnalisée *
              </label>
              <input
                type="text"
                required
                placeholder="Précisez la banque..."
                value={autreBanque}
                onChange={(e) => setAutreBanque(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          )}

          {/* Drawer / Beneficiary Parties */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Émetteur (Tireur) *
              </label>
              {typeOperation === "A_ENCAISSER" ? (
                <div className="space-y-2">
                  <select
                    value={selectedClientId}
                    onChange={(e) => handleClientSelect(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">-- Lier à un Client (Optionnel) --</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.nom} {c.tel ? `(${c.tel})` : ''}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    required
                    placeholder="Nom du tireur / signataire"
                    value={emetteurNom}
                    onChange={(e) => setEmetteurNom(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              ) : (
                <input
                  type="text"
                  required
                  placeholder="Notre Entreprise"
                  value={emetteurNom}
                  onChange={(e) => setEmetteurNom(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Bénéficiaire *
              </label>
              {typeOperation === "EMIS" ? (
                <div className="space-y-2">
                  <select
                    value={selectedFournisseurId}
                    onChange={(e) => handleFournisseurSelect(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">-- Lier à un Fournisseur (Optionnel) --</option>
                    {fournisseurs.map((f) => (
                      <option key={f.id} value={f.id}>{f.nom}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    required
                    placeholder="Nom du bénéficiaire"
                    value={beneficiaireNom}
                    onChange={(e) => setBeneficiaireNom(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              ) : (
                <input
                  type="text"
                  required
                  placeholder="Notre Entreprise"
                  value={beneficiaireNom}
                  onChange={(e) => setBeneficiaireNom(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              )}
            </div>
          </div>

          {/* Dates & Radar Alert */}
          <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 space-y-3">
            <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-300 font-semibold text-xs uppercase tracking-wider">
              <Clock size={15} className="text-indigo-600" />
              <span>Planning & Radar d'Échéance</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  Date d'Émission
                </label>
                <input
                  type="date"
                  required
                  value={dateEmission}
                  onChange={(e) => setDateEmission(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  Date d'Échéance (Encaissable le) *
                </label>
                <input
                  type="date"
                  required
                  value={dateEcheance}
                  onChange={(e) => setDateEcheance(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Quick due date buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Raccourci échéance :</span>
              {[
                { label: "Aujourd'hui", days: 0 },
                { label: "+15 jours", days: 15 },
                { label: "+30 jours", days: 30 },
                { label: "+60 jours", days: 60 },
                { label: "+90 jours", days: 90 },
              ].map((btn) => (
                <button
                  key={btn.label}
                  type="button"
                  onClick={() => handleQuickDueDate(btn.days)}
                  className="px-2.5 py-1 text-xs font-medium bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
              Notes & Commentaires (Optionnel)
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Réf facture n° 2026-081, bordereau remise remis par M. Oumarou..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Footer Submit */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-semibold text-sm shadow-md shadow-indigo-600/30 transition-all disabled:opacity-50"
            >
              <ShieldCheck size={18} />
              <span>{loading ? "Enregistrement..." : "Enregistrer dans le Coffre-Fort"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
