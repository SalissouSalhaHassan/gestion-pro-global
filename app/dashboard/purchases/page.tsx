"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { 
  ShoppingCart, 
  Search, 
  Plus, 
  Eye, 
  Trash2, 
  Printer, 
  Filter, 
  Calendar, 
  User, 
  FileText, 
  Loader2, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Wallet,
  Edit2,
  Sparkles,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Scale,
  Users,
  CreditCard,
  CheckCheck
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { formatCurrencyAmount } from "@/lib/utils/currency";

type Purchase = {
  id: number;
  numero_facture: string;
  date_achat: string;
  fournisseur_nom: string;
  montant_total: number;
  montant_paye: number;
  statut: string;
};

export default function PurchasesPage() {
  const { locale, dir } = useLanguage();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ ref: "", supplier: "", start_date: "", end_date: "", status: "all" });
  const [toast, setToast] = useState<{message: string, type: "success" | "error"} | null>(null);

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const queryParams: Record<string, string> = {};
      if (filters.ref) queryParams.ref = filters.ref;
      if (filters.supplier) queryParams.supplier = filters.supplier;
      if (filters.start_date) queryParams.start_date = filters.start_date;
      if (filters.end_date) queryParams.end_date = filters.end_date;

      const params = new URLSearchParams(queryParams).toString();
      const res = await fetch(`/api/purchases?${params}`, { cache: "no-store" });
      const data = await res.json();
      setPurchases(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch purchases", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, [filters.ref, filters.supplier, filters.start_date, filters.end_date]);

  const handleDelete = async (id: number) => {
    if (!confirm(locale === "ar" ? "هل أنت متأكد من حذف فاتورة الشراء هذه؟ لا يمكن التراجع عن هذا الإجراء." : "Voulez-vous vraiment supprimer cet achat ? Cette action est irréversible.")) return;
    try {
      const res = await fetch(`/api/purchases/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setPurchases(prev => prev.filter(p => p.id !== id));
      setToast({ message: locale === "ar" ? "تم حذف فاتورة الشراء بنجاح." : "Achat supprimé avec succès.", type: "success" });
    } catch (error) {
      setToast({ message: locale === "ar" ? "خطأ أثناء محاولة الحذف." : "Erreur lors de la suppression.", type: "error" });
    } finally {
      setTimeout(() => setToast(null), 3000);
    }
  };

  // Financial KPIs Calculations
  const stats = useMemo(() => {
    const totalAchats = purchases.reduce((sum, p) => sum + (Number(p.montant_total) || 0), 0);
    const totalPaye = purchases.reduce((sum, p) => sum + (Number(p.montant_paye) || 0), 0);
    const detteRestante = totalAchats - totalPaye;
    const count = purchases.length;
    return { totalAchats, totalPaye, detteRestante, count };
  }, [purchases]);

  // Client-side filtering by status if selected
  const filteredPurchases = useMemo(() => {
    if (filters.status === "all") return purchases;
    return purchases.filter(p => p.statut === filters.status);
  }, [purchases, filters.status]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Payée":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={12} />
            {locale === "ar" ? "مدفوعة بالكامل" : "Payée"}
          </span>
        );
      case "Partiellement Payée":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">
            <Clock size={12} />
            {locale === "ar" ? "مدفوعة جزئياً" : "Partielle"}
          </span>
        );
      case "Brouillon":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-200">
            {locale === "ar" ? "مسودة" : "Brouillon"}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle size={12} />
            {locale === "ar" ? "غير مدفوعة" : "Non Payée"}
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-12" dir={dir}>
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-2xl font-bold text-white flex items-center gap-3 transition-all animate-in slide-in-from-top-3 ${
          toast.type === "success" ? "bg-slate-900 border border-emerald-500/30 text-emerald-400" : "bg-rose-950 border border-rose-500/30 text-rose-400"
        }`}>
          <CheckCheck size={20} className={toast.type === "success" ? "text-emerald-400" : "text-rose-400"} />
          <span className="text-xs font-black text-white">{toast.message}</span>
        </div>
      )}

      {/* 4K Executive Hero Control Room */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-950 text-white rounded-[32px] p-6 lg:p-8 shadow-2xl border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-black tracking-wider flex items-center gap-1.5 shadow-md">
                <ShoppingCart size={14} />
                APPROVISIONNEMENT & ACHATS 4K
              </span>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-500/30">
                <Sparkles size={12} className="text-amber-400" />
                {stats.count} {locale === "ar" ? "فاتورة شراء مسجلة" : "Factures d'achat"}
              </span>
            </div>

            <h1 className="text-2xl lg:text-3xl font-black text-white">
              {locale === "ar" ? "سجل المشتريات وفواتير الموردين" : "Historique des Achats & Fournisseurs"}
            </h1>
            <p className="text-xs lg:text-sm text-slate-300 font-medium mt-1">
              {locale === "ar"
                ? "متابعة فواتير الشراء، مدفوعات الموردين، وإعادة تموين المخازن بدقة متناهية"
                : "Pilotage des approvisionnements, factures d'achat, règlements fournisseurs et réceptions"}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={fetchPurchases}
              className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm"
              title={locale === "ar" ? "تحديث" : "Actualiser"}
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              <span>{locale === "ar" ? "تحديث" : "Actualiser"}</span>
            </button>

            <Link
              href="/dashboard/suppliers"
              className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border border-white/10"
            >
              <Users size={15} className="text-indigo-400" />
              <span>{locale === "ar" ? "ملف الموردين" : "Fichier Fournisseurs"}</span>
            </Link>

            <Link
              href="/dashboard/purchases/new"
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-2xl font-black text-xs shadow-xl shadow-indigo-600/25 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus size={16} />
              <span>{locale === "ar" ? "فاتورة شراء جديدة" : "Nouvel Achat"}</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 4 Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "إجمالي المشتريات" : "Total des Achats"}
            </span>
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              <ShoppingCart size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {formatCurrencyAmount(stats.totalAchats, "FCFA")}
          </div>
          <p className="text-[11px] font-medium text-slate-500">
            {locale === "ar" ? "حجم المشتريات الكلي المفوتر" : "Volume total des commandes"}
          </p>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "المبالغ المسددة" : "Montant Réglé"}
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 font-mono">
            {formatCurrencyAmount(stats.totalPaye, "FCFA")}
          </div>
          <p className="text-[11px] font-medium text-slate-500">
            {locale === "ar" ? "المدفوعات المحولة للموردين" : "Règlements fournisseurs effectués"}
          </p>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "ديون الموردين المتبقية" : "Dettes Fournisseurs"}
            </span>
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600">
              <Scale size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600 font-mono">
            {formatCurrencyAmount(stats.detteRestante, "FCFA")}
          </div>
          <p className="text-[11px] font-medium text-slate-500">
            {locale === "ar" ? "المبالغ المستحقة غير المسددة" : "Restant dû à décaisser"}
          </p>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "عدد العمليات" : "Commandes d'Achat"}
            </span>
            <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600">
              <FileText size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-600 font-mono">
            {stats.count}
          </div>
          <p className="text-[11px] font-medium text-slate-500">
            {locale === "ar" ? "إجمالي الفواتير الصادرة" : "Factures d'achat validées"}
          </p>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 flex flex-wrap items-center gap-4">
        {/* Search by Ref */}
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={locale === "ar" ? "بحث برقم الفاتورة..." : "Réf. Facture Achat..."}
            value={filters.ref}
            onChange={(e) => setFilters({ ...filters, ref: e.target.value })}
            className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Search by Supplier */}
        <div className="relative flex-1 min-w-[180px]">
          <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={locale === "ar" ? "اسم المورد..." : "Nom du Fournisseur..."}
            value={filters.supplier}
            onChange={(e) => setFilters({ ...filters, supplier: e.target.value })}
            className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Date Range */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-1.5 text-xs">
          <Calendar size={14} className="text-slate-400" />
          <input
            type="date"
            value={filters.start_date}
            onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
            className="bg-transparent border-none text-xs font-bold text-slate-800 outline-none"
          />
          <span className="text-slate-400">→</span>
          <input
            type="date"
            value={filters.end_date}
            onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
            className="bg-transparent border-none text-xs font-bold text-slate-800 outline-none"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs">
          <Filter size={14} className="text-slate-400" />
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
          >
            <option value="all">{locale === "ar" ? "جميع الحالات" : "Tous les statuts"}</option>
            <option value="Payée">{locale === "ar" ? "مدفوعة بالكامل" : "Payée"}</option>
            <option value="Partiellement Payée">{locale === "ar" ? "مدفوعة جزئياً" : "Partiellement Payée"}</option>
            <option value="Non Payée">{locale === "ar" ? "غير مدفوعة" : "Non Payée"}</option>
            <option value="Brouillon">{locale === "ar" ? "مسودة" : "Brouillon"}</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <th className="px-6 py-4">{locale === "ar" ? "رقم الفاتورة" : "Réf. Facture"}</th>
                <th className="px-6 py-4">{locale === "ar" ? "التاريخ" : "Date"}</th>
                <th className="px-6 py-4">{locale === "ar" ? "المورد" : "Fournisseur"}</th>
                <th className="px-6 py-4 text-right">{locale === "ar" ? "الإجمالي" : "Montant Total"}</th>
                <th className="px-6 py-4 text-right">{locale === "ar" ? "المدفوع" : "Payé"}</th>
                <th className="px-6 py-4 text-right">{locale === "ar" ? "المتبقي" : "Reste"}</th>
                <th className="px-6 py-4 text-center">{locale === "ar" ? "الحالة" : "Statut"}</th>
                <th className="px-6 py-4 text-center">{locale === "ar" ? "الإجراءات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Loader2 className="animate-spin mb-3 text-indigo-600" size={36} />
                      <p className="font-bold text-slate-600 text-xs">
                        {locale === "ar" ? "جاري تحميل سجل المشتريات..." : "Chargement des achats..."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <ShoppingCart className="opacity-20 mb-3 text-indigo-600" size={48} />
                      <p className="font-black text-slate-700 text-sm">
                        {locale === "ar" ? "لا توجد فواتير شراء مسجلة مطابقة للبحث." : "Aucun achat enregistré."}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {locale === "ar"
                          ? "اضغط على زر فاتورة شراء جديدة لإدخال أول عملية شراء."
                          : "Créez votre premier achat en cliquant sur Nouvel Achat."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((purchase) => {
                  const reste = (Number(purchase.montant_total) || 0) - (Number(purchase.montant_paye) || 0);

                  return (
                    <tr key={purchase.id} className="hover:bg-slate-50/70 transition-colors group">
                      <td className="px-6 py-4 font-black text-slate-900 font-mono">
                        {purchase.numero_facture}
                      </td>
                      <td className="px-6 py-4 text-slate-500 font-medium">
                        {purchase.date_achat ? new Date(purchase.date_achat).toLocaleDateString("fr-FR") : "-"}
                      </td>
                      <td className="px-6 py-4 text-slate-900 font-bold">
                        {purchase.fournisseur_nom}
                      </td>
                      <td className="px-6 py-4 text-right font-black text-slate-900 font-mono">
                        {formatCurrencyAmount(purchase.montant_total, "FCFA")}
                      </td>
                      <td className="px-6 py-4 text-right font-black text-emerald-600 font-mono">
                        {formatCurrencyAmount(purchase.montant_paye, "FCFA")}
                      </td>
                      <td className="px-6 py-4 text-right font-black text-rose-600 font-mono">
                        {formatCurrencyAmount(reste, "FCFA")}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {getStatusBadge(purchase.statut)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Payments Link */}
                          <Link
                            href={`/dashboard/purchases/${purchase.id}/payments`}
                            title={locale === "ar" ? "سداد دفعات للمورد" : "Règlements fournisseur"}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                          >
                            <Wallet size={16} />
                          </Link>

                          {/* Edit Link */}
                          <Link
                            href={`/dashboard/purchases/new?id=${purchase.id}`}
                            title={locale === "ar" ? "تعديل الفاتورة" : "Modifier l'achat"}
                            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                          >
                            <Edit2 size={16} />
                          </Link>

                          {/* PDF View */}
                          <button
                            onClick={() => window.open(`/api/purchases/${purchase.id}/pdf`, "_blank")}
                            title={locale === "ar" ? "طباعة الفاتورة A4" : "Aperçu / Imprimer PDF"}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all cursor-pointer"
                          >
                            <Printer size={16} />
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => handleDelete(purchase.id)}
                            title={locale === "ar" ? "حذف" : "Supprimer"}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
