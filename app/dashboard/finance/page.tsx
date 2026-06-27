"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, BarChart3, Bell, Calendar, ChevronLeft, ChevronRight, Columns3, Download,
  Eye, FileSpreadsheet, FileText, Filter, Mail, Printer, RefreshCw, Search, Send, Shield,
  SlidersHorizontal, TrendingUp, Wallet
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";

const colors = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#7c3aed", "#0891b2", "#db2777"];
const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n || 0)));
const today = new Date().toISOString().slice(0, 10);

type FinanceData = {
  summary: Record<string, number>;
  charts: Record<string, any[]>;
  analysis: Record<string, any>;
  alerts: { type: string; count: number; level: string }[];
  reports: string[];
  rows: any[];
  filters: { start: string; end: string; period: string; cashier: string; isPrivileged: boolean };
  security: string[];
};

const defaultHidden = new Set<string>();

export default function FinanceCenterPage() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("jour");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState({ key: "date", asc: false });
  const [selectedReport, setSelectedReport] = useState("Rapport Mensuel");
  const [hiddenColumns, setHiddenColumns] = useState(defaultHidden);
  const [filters, setFilters] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    end: today,
    schoolYear: "2024 - 2025",
    month: "",
    classe: "",
    niveau: "",
    secteur: "",
    eleve: "",
    mode: "",
    statut: "",
    utilisateur: "",
    caissier: "",
    banque: "",
    reference: "",
    min: "",
    max: "",
  });

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams({ start: filters.start, end: filters.end, period, cashier: filters.caissier || "Tous" });
    const res = await fetch(`/api/finance?${params.toString()}`, { cache: "no-store" });
    const json = await res.json();
    setData(json);
    setLoading(false);
  };

  useEffect(() => { load().catch(console.error); }, [period]);

  const rows = useMemo(() => {
    let list = data?.rows || [];
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((r) => Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(q)));
    }
    if (filters.classe) list = list.filter((r) => r.classe === filters.classe);
    if (filters.niveau) list = list.filter((r) => r.niveau === filters.niveau);
    if (filters.secteur) list = list.filter((r) => r.secteur === filters.secteur);
    if (filters.eleve) list = list.filter((r) => r.eleve.toLowerCase().includes(filters.eleve.toLowerCase()));
    if (filters.mode) list = list.filter((r) => r.modePaiement === filters.mode);
    if (filters.statut) list = list.filter((r) => r.statut === filters.statut);
    if (filters.reference) list = list.filter((r) => r.reference.toLowerCase().includes(filters.reference.toLowerCase()));
    if (filters.min) list = list.filter((r) => r.montantPaye >= Number(filters.min));
    if (filters.max) list = list.filter((r) => r.montantPaye <= Number(filters.max));
    return [...list].sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      return (av > bv ? 1 : av < bv ? -1 : 0) * (sort.asc ? 1 : -1);
    });
  }, [data, query, filters, sort]);

  const options = (key: string) => Array.from(new Set((data?.rows || []).map((r) => r[key]).filter(Boolean)));
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const visibleRows = rows.slice((page - 1) * pageSize, page * pageSize);

  const columns = [
    ["no", "N°"], ["reference", "Référence"], ["eleve", "Élève"], ["classe", "Classe"], ["niveau", "Niveau"],
    ["secteur", "Secteur"], ["montantAttendu", "Montant Attendu"], ["montantPaye", "Montant Payé"], ["reste", "Reste"],
    ["statut", "Statut"], ["date", "Date"], ["modePaiement", "Mode Paiement"], ["caissier", "Caissier"],
    ["referencePaiement", "Référence Paiement"], ["observation", "Observation"]
  ];

  const exportCsv = () => {
    const header = columns.map((c) => c[1]).join(";");
    const body = rows.map((r) => columns.map(([k]) => `"${String(r[k] ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rapport-financier-${filters.start}-${filters.end}.csv`;
    a.click();
  };

  const printReport = () => window.print();
  const summary = data?.summary || {};

  const cardRows = [
    [["Total Attendu", summary.totalExpected, Wallet], ["Total Encaissé", summary.totalPaid, TrendingUp], ["Total Impayé", summary.totalUnpaid, AlertTriangle], ["Solde Actuel", summary.balance, BarChart3]],
    [["Taux de Recouvrement", `${(summary.recoveryRate || 0).toFixed(2)}%`, Shield], ["Nombre de Paiements", summary.paymentCount, FileText], ["Nombre d'Élèves Payés", summary.paidStudents, Eye], ["Nombre d'Élèves Impayés", summary.unpaidStudents, Bell]],
    [["Revenus Aujourd'hui", summary.revenueToday, Calendar], ["Revenus Cette Semaine", summary.revenueWeek, Calendar], ["Revenus Ce Mois", summary.revenueMonth, Calendar], ["Revenus Cette Année", summary.revenueYear, Calendar]],
  ];

  return (
    <div className="space-y-6 text-slate-900 print:bg-white">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between print:block">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">Centre de suivi, d'analyse et de reporting financier</p>
          <h1 className="text-3xl font-black tracking-tight md:text-4xl">Gestion Financière</h1>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          {[["PDF", FileText, printReport], ["Excel", FileSpreadsheet, exportCsv], ["CSV", Download, exportCsv], ["Impression", Printer, printReport], ["Partager", Send, exportCsv], ["Email", Mail, exportCsv]].map(([label, Icon, action]: any) => (
            <button key={label} onClick={action} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black shadow-sm hover:border-indigo-300 hover:text-indigo-600">
              <Icon size={16} />{label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        {cardRows.map((line, i) => (
          <div key={i} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {line.map(([label, value, Icon]: any, idx) => (
              <button key={label} onClick={() => setQuery(String(label).includes("Impay") ? "Impayé" : "")} className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</span>
                  <span className="rounded-xl p-2 text-white" style={{ background: colors[(i * 4 + idx) % colors.length] }}><Icon size={18} /></span>
                </div>
                <p className="mt-4 text-2xl font-black">{typeof value === "string" ? value : `${fmt(value)} CFA`}</p>
                <p className="mt-2 text-xs font-bold text-emerald-600">Analyse interactive</p>
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-3">
            <ChartCard title="Évolution des Encaissements" action={<select value={period} onChange={(e) => setPeriod(e.target.value)} className="rounded-lg border px-2 py-1 text-xs font-bold"><option value="jour">Jour</option><option value="semaine">Semaine</option><option value="mois">Mois</option><option value="annee">Année</option></select>}>
              <AreaGraph data={data?.charts?.evolution || []} />
            </ChartCard>
            <ChartCard title="Répartition des Paiements"><Donut data={data?.charts?.repartition || []} /></ChartCard>
            <ChartCard title="Modes de Paiement"><Donut data={data?.charts?.modes || []} /></ChartCard>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <ChartCard title="Revenus par Classe"><Bars data={data?.charts?.byClass || []} /></ChartCard>
            <ChartCard title="Attendu VS Encaissé"><Compare data={data?.charts?.comparison || []} /></ChartCard>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <ChartCard title="Revenus par Niveau"><Bars data={data?.charts?.byLevel || []} /></ChartCard>
            <ChartCard title="Revenus par Secteur"><Bars data={data?.charts?.bySector || []} /></ChartCard>
          </div>
        </div>

        <aside className="space-y-4 print:hidden">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 font-black"><FileText size={18} /> Rapports Avancés</h2>
            <div className="max-h-[380px] space-y-1 overflow-auto pr-1">
              {(data?.reports || []).map((r) => (
                <button key={r} onClick={() => setSelectedReport(r)} className={`w-full rounded-lg px-3 py-2 text-left text-xs font-bold ${selectedReport === r ? "bg-indigo-600 text-white" : "hover:bg-slate-50"}`}>{r}</button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 font-black"><AlertTriangle size={18} /> Intelligence</h2>
            <div className="space-y-2">
              {(data?.alerts || []).map((a) => <div key={a.type} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold"><span>{a.type}</span><span className="text-indigo-600">{a.count}</span></div>)}
            </div>
          </div>
        </aside>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
        <div className="mb-4 flex items-center gap-2 font-black"><Filter size={18} /> Filtres Avancés</div>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Input label="Date début" type="date" value={filters.start} onChange={(v) => setFilters({ ...filters, start: v })} />
          <Input label="Date fin" type="date" value={filters.end} onChange={(v) => setFilters({ ...filters, end: v })} />
          <Input label="Année scolaire" value={filters.schoolYear} onChange={(v) => setFilters({ ...filters, schoolYear: v })} />
          <Input label="Mois" type="month" value={filters.month} onChange={(v) => setFilters({ ...filters, month: v })} />
          <Select label="Classe" value={filters.classe} onChange={(v) => setFilters({ ...filters, classe: v })} options={options("classe")} />
          <Select label="Niveau" value={filters.niveau} onChange={(v) => setFilters({ ...filters, niveau: v })} options={options("niveau")} />
          <Select label="Secteur" value={filters.secteur} onChange={(v) => setFilters({ ...filters, secteur: v })} options={options("secteur")} />
          <Input label="Élève" value={filters.eleve} onChange={(v) => setFilters({ ...filters, eleve: v })} />
          <Select label="Mode paiement" value={filters.mode} onChange={(v) => setFilters({ ...filters, mode: v })} options={options("modePaiement")} />
          <Select label="Statut" value={filters.statut} onChange={(v) => setFilters({ ...filters, statut: v })} options={["Payé", "Partiel", "Impayé"]} />
          <Input label="Utilisateur" value={filters.utilisateur} onChange={(v) => setFilters({ ...filters, utilisateur: v })} />
          <Input label="Caissier" value={filters.caissier} onChange={(v) => setFilters({ ...filters, caissier: v })} />
          <Input label="Banque" value={filters.banque} onChange={(v) => setFilters({ ...filters, banque: v })} />
          <Input label="Référence" value={filters.reference} onChange={(v) => setFilters({ ...filters, reference: v })} />
          <Input label="Montant Min" type="number" value={filters.min} onChange={(v) => setFilters({ ...filters, min: v })} />
          <Input label="Montant Max" type="number" value={filters.max} onChange={(v) => setFilters({ ...filters, max: v })} />
          <button onClick={load} className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-black text-white"><RefreshCw size={16} />Filtrer</button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3 print:hidden">
        {[
          ["Croissance Mensuelle", `${(data?.analysis?.monthlyGrowth || 0).toFixed(1)}%`],
          ["Prévision de Revenus", `${fmt(data?.analysis?.revenueForecast || 0)} CFA`],
          ["Analyse des Retards", `${data?.analysis?.delayRisk || 0} dossiers`],
          ["Analyse des Créances", `${fmt(data?.analysis?.receivables || 0)} CFA`],
          ["Prévision de Trésorerie", `${fmt(data?.analysis?.treasuryForecast || 0)} CFA`],
          ["Taux de Paiement", `${(data?.analysis?.paymentRate || 0).toFixed(1)}%`],
        ].map(([label, value]) => <div key={label} className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase text-slate-500">{label}</p><p className="mt-2 text-xl font-black text-indigo-600">{value}</p></div>)}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between print:block">
          <div>
            <h2 className="font-black">Tableau Professionnel - {selectedReport}</h2>
            <p className="text-xs font-bold text-slate-500">Sous-totaux, total général, pourcentage, signature, cachet et page imprimés dans le rapport PDF.</p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <div className="flex items-center gap-2 rounded-xl border px-3 py-2"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Recherche..." className="w-44 outline-none text-sm" /></div>
            <button onClick={() => setHiddenColumns(new Set(hiddenColumns.size ? [] : ["niveau", "secteur", "observation"]))} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black"><Columns3 size={16} />Colonnes</button>
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[1500px] table-fixed text-left text-sm">
            <thead className="bg-slate-50">
              <tr>{columns.filter(([k]) => !hiddenColumns.has(k)).map(([k, label]) => <th key={k} onClick={() => setSort({ key: k, asc: sort.key === k ? !sort.asc : true })} className="resize-x overflow-auto border-b px-3 py-3 text-[11px] font-black uppercase text-slate-500 cursor-pointer">{label}</th>)}</tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={columns.length} className="p-10 text-center font-bold text-slate-400">Chargement du centre financier...</td></tr> : visibleRows.map((r) => (
                <tr key={`${r.reference}-${r.no}`} className="border-b hover:bg-indigo-50/30">
                  {columns.filter(([k]) => !hiddenColumns.has(k)).map(([k]) => <td key={k} className="px-3 py-3 font-semibold text-slate-700">{typeof r[k] === "number" && k !== "no" ? fmt(r[k]) : r[k]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 text-xs font-bold text-slate-500 print:hidden">
          <span>Affichage {visibleRows.length} sur {rows.length} résultats</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(Math.max(1, page - 1))} className="rounded-lg border p-2"><ChevronLeft size={16} /></button>
            <span>Page {page} / {pages}</span>
            <button onClick={() => setPage(Math.min(pages, page + 1))} className="rounded-lg border p-2"><ChevronRight size={16} /></button>
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="rounded-lg border px-2 py-2"><option>5</option><option>10</option><option>25</option><option>50</option></select>
          </div>
        </div>
      </div>

      <div className="hidden print:block p-8">
        <div className="flex justify-between border-b pb-4">
          <div><h2 className="text-2xl font-black">ÉCOLE EXCELLENCE</h2><p>Adresse - Téléphone - Année scolaire {filters.schoolYear}</p></div>
          <div className="text-right"><p>Date Impression: {new Date().toLocaleString("fr-FR")}</p><p>Utilisateur: {data?.filters?.cashier || "Admin"}</p></div>
        </div>
        <h1 className="my-6 text-center text-2xl font-black">{selectedReport}</h1>
        <div className="mt-10 flex justify-between"><span>Signature</span><span>Cachet</span><span>Page 1</span></div>
      </div>
    </div>
  );
}

function ChartCard({ title, children, action }: any) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between"><h2 className="font-black">{title}</h2>{action}</div><div className="h-72">{children}</div></div>;
}
function AreaGraph({ data }: any) { return <ResponsiveContainer width="100%" height="100%"><AreaChart data={data}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={(v: any) => `${fmt(v)} CFA`} /><Area dataKey="value" stroke="#2563eb" fill="#dbeafe" strokeWidth={3} /></AreaChart></ResponsiveContainer>; }
function Donut({ data }: any) { return <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={90} paddingAngle={3}>{data.map((_: any, i: number) => <Cell key={i} fill={colors[i % colors.length]} />)}</Pie><Tooltip formatter={(v: any) => fmt(v)} /><Legend /></PieChart></ResponsiveContainer>; }
function Bars({ data }: any) { return <ResponsiveContainer width="100%" height="100%"><BarChart data={data.slice(0, 8)}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip formatter={(v: any) => `${fmt(v)} CFA`} /><Bar dataKey="value" fill="#10b981" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer>; }
function Compare({ data }: any) { return <ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis tick={{ fontSize: 10 }} /><Tooltip formatter={(v: any) => `${fmt(v)} CFA`} /><Legend /><Bar dataKey="attendu" fill="#f59e0b" radius={[8, 8, 0, 0]} /><Bar dataKey="encaisse" fill="#2563eb" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer>; }
function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label className="text-xs font-black text-slate-500">{label}<input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400" /></label>; }
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) { return <label className="text-xs font-black text-slate-500">{label}<select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400"><option value="">Tous</option>{options.map((o: string) => <option key={o} value={o}>{o}</option>)}</select></label>; }
