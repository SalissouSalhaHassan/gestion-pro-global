"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Truck,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Navigation,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  DollarSign,
  Printer,
  MessageCircle,
  Loader2,
  PackageCheck
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { formatCurrencyAmount } from "@/lib/utils/currency";
import NewRunModal from "./NewRunModal";
import RunDetailModal from "./RunDetailModal";

type DeliveryRun = {
  id: number;
  reference: string;
  chauffeur_nom: string;
  chauffeur_tel: string | null;
  vehicule_matricule: string | null;
  statut: string;
  zone_livraison: string | null;
  total_colis: number;
  total_montant_a_encaisser: number;
  total_encaisse: number;
  created_at: string;
  colis: any[];
};

export default function DeliveriesPage() {
  const { locale, dir } = useLanguage();
  const [runs, setRuns] = useState<DeliveryRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedRun, setSelectedRun] = useState<DeliveryRun | null>(null);

  const fetchRuns = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/deliveries");
      const data = await res.json();
      setRuns(data.runs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, []);

  const filteredRuns = useMemo(() => {
    return runs.filter((r) => {
      const matchStatus = statusFilter === "ALL" || r.statut === statusFilter;
      const q = search.toLowerCase();
      const matchSearch =
        !search ||
        r.reference.toLowerCase().includes(q) ||
        r.chauffeur_nom.toLowerCase().includes(q) ||
        (r.zone_livraison && r.zone_livraison.toLowerCase().includes(q)) ||
        (r.vehicule_matricule && r.vehicule_matricule.toLowerCase().includes(q));
      return matchStatus && matchSearch;
    });
  }, [runs, statusFilter, search]);

  const activeRunsCount = runs.filter((r) => r.statut === "EN_ROUTE").length;
  const totalCOD = runs.reduce((sum, r) => sum + (Number(r.total_montant_a_encaisser) || 0), 0);
  const totalEncaisse = runs.reduce((sum, r) => sum + (Number(r.total_encaisse) || 0), 0);
  const totalColis = runs.reduce((sum, r) => sum + (Number(r.total_colis) || 0), 0);

  const getStatusBadge = (statut: string) => {
    switch (statut) {
      case "EN_ROUTE":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200 animate-pulse">
            <Navigation size={12} className="text-indigo-600" />
            EN ROUTE
          </span>
        );
      case "TERMINEE":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 size={12} className="text-emerald-600" />
            TERMINÉE
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
            <Clock size={12} className="text-amber-600" />
            EN PRÉPARATION
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-12 font-sans" dir={dir}>
      {/* 4K Hero Header */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white rounded-[32px] p-6 lg:p-8 shadow-2xl border border-indigo-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-xl bg-indigo-600 text-white text-xs font-black tracking-wider flex items-center gap-1.5 shadow-md">
                <Truck size={14} />
                DISPATCH & LOGISTICS STUDIO 4K
              </span>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-500/30">
                <PackageCheck size={12} className="text-emerald-400" />
                PREUVE DE LIVRAISON (POD)
              </span>
            </div>

            <h1 className="text-2xl lg:text-3xl font-black text-white">
              {locale === "ar" ? "دورات التوصيل وسندات الشحن الميداني (Delivery Dispatch)" : "Logistique & Tournées de Livraison"}
            </h1>
            <p className="text-xs lg:text-sm text-slate-300 font-medium mt-1">
              {locale === "ar"
                ? "تسيير السائقين والشاحنات، أوراق التوصيل، متابعة التحصيل عند التسليم (COD) والإثبات الرقمي"
                : "Organisez les tournées chauffeurs, suivez les encaissements à la livraison et confirmez les réceptions"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchRuns}
              className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm"
              title="Actualiser"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>

            <button
              onClick={() => setIsNewModalOpen(true)}
              className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-all flex items-center gap-2 shadow-lg cursor-pointer"
            >
              <Plus size={16} />
              <span>{locale === "ar" ? "إنشاء دورة توصيل" : "Nouvelle Tournée"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 KPIs Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "شاحنات في الطريق" : "Tournées en Route"}
            </span>
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              <Navigation size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-indigo-700 font-mono">
            {activeRunsCount}
          </div>
          <p className="text-[11px] font-medium text-slate-500">
            {locale === "ar" ? "سائقين يقومون بالتوزيع حالياً" : "Véhicules en cours de livraison"}
          </p>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "إجمالي الطرود المشحونة" : "Colis Expédiés"}
            </span>
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
              <Truck size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {totalColis}
          </div>
          <p className="text-[11px] font-medium text-slate-500">
            {locale === "ar" ? "شحنات وزبائن مستلمين" : "Points de déchargement gérés"}
          </p>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "أموال للتحصيل (COD)" : "Montant à Encaisser (COD)"}
            </span>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="text-xl font-black text-amber-700 font-mono">
            {formatCurrencyAmount(totalCOD, "FCFA")}
          </div>
          <p className="text-[11px] font-medium text-slate-500">
            {locale === "ar" ? "مبالغ فواتير تحت مسؤولية السائقين" : "Contre-remboursement attendu"}
          </p>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "المبالغ المحصلة فعلياً" : "Fonds Déjà Encaissés"}
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="text-xl font-black text-emerald-600 font-mono">
            {formatCurrencyAmount(totalEncaisse, "FCFA")}
          </div>
          <p className="text-[11px] font-medium text-slate-500">
            {locale === "ar" ? "أموال تم استلامها من الزبائن" : "Total remis par les livreurs"}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={locale === "ar" ? "بحث برقم الرحلة، السائق، المنطقة، أو المركبة..." : "Rechercher par référence, chauffeur, zone..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl text-xs">
          {["ALL", "EN_PREPARATION", "EN_ROUTE", "TERMINEE"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                statusFilter === s
                  ? "bg-white text-slate-900 shadow-xs font-black"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {s === "ALL"
                ? locale === "ar" ? "الكل" : "Toutes"
                : s === "EN_ROUTE"
                ? locale === "ar" ? "في الطريق" : "En Route"
                : s === "TERMINEE"
                ? locale === "ar" ? "مكتملة" : "Terminées"
                : locale === "ar" ? "قيد التحضير" : "En Préparation"}
            </button>
          ))}
        </div>
      </div>

      {/* Delivery Runs Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <th className="px-6 py-4">Référence</th>
                <th className="px-6 py-4">{locale === "ar" ? "السائق / الهاتف" : "Chauffeur / Contact"}</th>
                <th className="px-6 py-4">{locale === "ar" ? "المركبة والمنطقة" : "Véhicule & Zone"}</th>
                <th className="px-6 py-4 text-center">{locale === "ar" ? "عدد الطرود" : "Colis"}</th>
                <th className="px-6 py-4 text-right">{locale === "ar" ? "مبلغ COD" : "À Encaisser (COD)"}</th>
                <th className="px-6 py-4 text-center">{locale === "ar" ? "الحالة" : "Statut"}</th>
                <th className="px-6 py-4 text-right">{locale === "ar" ? "الإجراءات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Loader2 className="animate-spin mb-3 text-indigo-600" size={36} />
                      <p className="font-bold text-slate-600 text-xs">
                        Chargement des tournées de livraison...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredRuns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center text-slate-400 font-bold">
                    Aucune tournée de livraison enregistrée.
                  </td>
                </tr>
              ) : (
                filteredRuns.map((run) => (
                  <tr key={run.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4 font-mono font-black text-indigo-700">
                      {run.reference}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{run.chauffeur_nom}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{run.chauffeur_tel || "Sans téléphone"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">{run.vehicule_matricule || "Non spécifié"}</div>
                      <div className="text-[11px] text-slate-500">{run.zone_livraison || "Ville"}</div>
                    </td>
                    <td className="px-6 py-4 text-center font-mono font-bold text-slate-800">
                      {run.total_colis}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-black text-amber-700">
                      {formatCurrencyAmount(run.total_montant_a_encaisser, "FCFA")}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {getStatusBadge(run.statut)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedRun(run)}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-indigo-700 text-white font-black text-xs transition-all flex items-center gap-1.5 ml-auto cursor-pointer shadow-2xs"
                      >
                        <Printer size={13} />
                        <span>Feuille de Route</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Delivery Run Modal */}
      {isNewModalOpen && (
        <NewRunModal
          onClose={() => setIsNewModalOpen(false)}
          onCreated={() => {
            setIsNewModalOpen(false);
            fetchRuns();
          }}
        />
      )}

      {/* Run Detail & Dispatch Modal */}
      {selectedRun && (
        <RunDetailModal
          run={selectedRun}
          onClose={() => setSelectedRun(null)}
          onUpdated={() => {
            fetchRuns();
          }}
        />
      )}
    </div>
  );
}
