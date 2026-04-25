"use client";

import { useState, useEffect } from "react";
import { 
  BarChart3, Search, Filter, Printer, Download, 
  Loader2, Wallet, Boxes, TrendingUp, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";

export default function StockValuationPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    depot: "Tous",
    categoryId: "all"
  });
  const [categories, setCategories] = useState<any[]>([]);
  const [depots, setDepots] = useState<any[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        depot: filters.depot,
        categoryId: filters.categoryId
      }).toString();
      
      const res = await fetch(`/api/stock/valuation?${query}`);
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFilters = async () => {
    try {
      const [catsRes, depotsRes] = await Promise.all([
        fetch("/api/stock/categories"),
        fetch("/api/stock/depots")
      ]);
      setCategories(await catsRes.json());
      setDepots(await depotsRes.json());
    } catch (error) {
      console.error("Filter fetch error:", error);
    }
  };

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    fetchData();
  }, [filters]);

  const filteredItems = data?.items?.filter((item: any) => 
    item.reference.toLowerCase().includes(search.toLowerCase()) ||
    item.designation.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const handlePrint = () => {
    const query = new URLSearchParams({
      depot: filters.depot,
      categoryId: filters.categoryId,
      type: "valuation"
    }).toString();
    window.open(`/api/stock/print?${query}`, "_blank");
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-3 bg-indigo-600 rounded-3xl shadow-xl shadow-indigo-200 text-white">
              <BarChart3 size={32} />
            </div>
            Valorisation du Stock
          </h1>
          <p className="text-slate-500 font-medium mt-2 uppercase text-[10px] tracking-widest ml-1">Analyse de la Valeur d'Inventaire et État des Stocks</p>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={handlePrint}
            className="rounded-2xl h-12 px-6 font-black bg-slate-900 hover:bg-slate-800 shadow-xl shadow-slate-200 transition-all hover:scale-105 active:scale-95"
          >
            <Printer size={18} className="mr-2" /> Imprimer Rapport
          </Button>
          <Button 
            variant="outline"
            className="rounded-2xl h-12 px-6 font-black border-slate-200 hover:bg-slate-50 transition-all"
          >
            <Download size={18} className="mr-2 text-slate-500" /> Excel
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: "Articles Valorisés", value: data.summary.total_items, icon: Boxes, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100" },
            { label: "Quantité Totale", value: new Intl.NumberFormat().format(data.summary.total_qte), icon: Boxes, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
            { label: "Valeur Achat HT", value: `${new Intl.NumberFormat().format(data.summary.total_valeur_achat)} F`, icon: Wallet, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
            { label: "Valeur Vente TTC", value: `${new Intl.NumberFormat().format(data.summary.total_valeur_vente)} F`, icon: TrendingUp, color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-100" },
          ].map((kpi, i) => (
            <div key={i} className={`bg-white rounded-[32px] p-6 border-2 ${kpi.border} shadow-sm group transition-all duration-300 hover:shadow-xl hover:translate-y-[-4px]`}>
              <div className={`w-14 h-14 ${kpi.bg} ${kpi.color} rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:rotate-12`}>
                <kpi.icon size={28} />
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{kpi.label}</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Main Workspace */}
      <div className="bg-white rounded-[40px] p-8 shadow-xl border border-slate-100">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
          <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
            <div className="w-full lg:w-48">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Dépôt</Label>
              <Select value={filters.depot} onValueChange={(v) => setFilters({ ...filters, depot: v })}>
                <SelectTrigger className="h-12 rounded-xl border-slate-100 bg-slate-50/50 font-bold transition-all">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tous">Tous les dépôts</SelectItem>
                  {depots.map(d => <SelectItem key={d.id} value={d.nom}>{d.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full lg:w-48">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Famille</Label>
              <Select value={filters.categoryId} onValueChange={(v) => setFilters({ ...filters, categoryId: v })}>
                <SelectTrigger className="h-12 rounded-xl border-slate-100 bg-slate-50/50 font-bold transition-all">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les familles</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full lg:w-96">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
              <Input 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-12 pl-12 rounded-2xl border-slate-100 bg-slate-50/50 focus:bg-white transition-all font-bold"
                placeholder="Rechercher un article..."
              />
            </div>
            <Button onClick={fetchData} variant="outline" className="h-12 w-12 rounded-2xl border-slate-200 hover:bg-slate-50">
              <Filter size={18} />
            </Button>
          </div>
        </div>

        <div className="rounded-[32px] border border-slate-100 overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-slate-100">
                <TableHead className="font-black text-slate-400 uppercase text-[10px] tracking-widest px-6 h-14">Référence</TableHead>
                <TableHead className="font-black text-slate-400 uppercase text-[10px] tracking-widest h-14">Désignation</TableHead>
                <TableHead className="font-black text-slate-400 uppercase text-[10px] tracking-widest h-14">Famille</TableHead>
                <TableHead className="font-black text-slate-400 uppercase text-[10px] tracking-widest h-14 text-center">Quantité</TableHead>
                <TableHead className="font-black text-slate-400 uppercase text-[10px] tracking-widest h-14 text-right">P. Achat HT</TableHead>
                <TableHead className="font-black text-slate-400 uppercase text-[10px] tracking-widest h-14 text-right pr-8">Valeur Totale</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="h-60 text-center"><Loader2 className="animate-spin mx-auto text-indigo-500" size={40} /></TableCell></TableRow>
              ) : filteredItems.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-60 text-center text-slate-400 font-bold">Aucune donnée trouvée.</TableCell></TableRow>
              ) : filteredItems.map((item: any) => (
                <TableRow key={item.id} className="hover:bg-slate-50/30 transition-colors border-slate-50">
                  <TableCell className="px-6 py-5 font-black text-slate-900">{item.reference}</TableCell>
                  <TableCell className="font-bold text-slate-700">{item.designation}</TableCell>
                  <TableCell>
                    <span className="px-3 py-1 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider">{item.famille}</span>
                  </TableCell>
                  <TableCell className="text-center font-black text-indigo-600">
                    {new Intl.NumberFormat().format(item.quantite)} <small className="text-[10px] text-slate-400">{item.unite}</small>
                  </TableCell>
                  <TableCell className="text-right font-bold text-slate-600">
                    {new Intl.NumberFormat().format(item.p_achat_ht)} F
                  </TableCell>
                  <TableCell className="text-right pr-8">
                    <div className="font-black text-slate-900">{new Intl.NumberFormat().format(item.total_valeur_achat)} F</div>
                    <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-tighter">Vente: {new Intl.NumberFormat().format(item.total_valeur_vente)} F</div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode, className?: string }) {
  return <label className={className}>{children}</label>;
}
