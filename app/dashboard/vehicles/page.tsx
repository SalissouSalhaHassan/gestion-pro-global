"use client";

import { useState, useEffect } from "react";
import { 
  Plus, Search, Car, Truck, Wrench, Wallet, AlertTriangle, 
  Trash2, Edit3, Filter, Loader2, Info, CheckCircle2, XCircle, Hash
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
// import { toast } from "sonner";
const toast = {
  error: (msg: string) => alert(msg),
  success: (msg: string) => alert(msg)
};
import VehicleFormDialog from "@/components/vehicles/VehicleFormDialog";
import RecordFormDialog from "@/components/vehicles/RecordFormDialog";
import VehiclePrintModal from "@/components/vehicles/VehiclePrintModal";
import { Printer } from "lucide-react";

export default function VehiclesPage() {
  const [stats, setStats] = useState<any>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("vehicles");

  // Dialog states
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [recordType, setRecordType] = useState<"FRAI" | "DEPENSE">("FRAI");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, vehiclesRes, recordsRes] = await Promise.all([
        fetch("/api/vehicles/stats"),
        fetch(`/api/vehicles?search=${search}`),
        fetch("/api/vehicles/records")
      ]);

      const [statsData, vehiclesData, recordsData] = await Promise.all([
        statsRes.json(),
        vehiclesRes.json(),
        recordsRes.json()
      ]);

      setStats(statsData);
      setVehicles(vehiclesData);
      setRecords(recordsData);
    } catch (error) {
      toast.error("Erreur de chargement des données");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  const handleDeleteVehicle = async (id: string) => {
    if (!confirm("Voulez-vous vraiment supprimer ce véhicule ?")) return;
    try {
      const res = await fetch(`/api/vehicles/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Véhicule supprimé");
      fetchData();
    } catch (error) {
      toast.error("Erreur de suppression");
    }
  };

  const getDocStatus = (vehicle: any) => {
    const today = new Date();
    const vigDate = vehicle.date_expiration ? new Date(vehicle.date_expiration) : null;
    const assDate = vehicle.date_assurance_exp ? new Date(vehicle.date_assurance_exp) : null;

    const isVigExp = vigDate && vigDate < today;
    const isAssExp = assDate && assDate < today;

    if (isVigExp && isAssExp) return { label: "🚫 A+V Exp.", color: "text-rose-600 bg-rose-50" };
    if (isVigExp) return { label: "⚠️ Vig. Exp.", color: "text-amber-600 bg-amber-50" };
    if (isAssExp) return { label: "⚠️ Assur. Exp.", color: "text-amber-600 bg-amber-50" };
    return { label: "✅ OK", color: "text-emerald-600 bg-emerald-50" };
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-3 bg-indigo-600 rounded-3xl shadow-xl shadow-indigo-200 text-white">
              <Car size={32} />
            </div>
            Parc Automobile & Logistique
          </h1>
          <p className="text-slate-500 font-medium mt-2 uppercase text-[10px] tracking-widest ml-1 font-outfit">Suivi de la Flotte, Transports et Maintenance Préventive</p>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={() => { setSelectedVehicle(null); setVehicleDialogOpen(true); }}
            className="rounded-2xl h-12 px-6 font-black bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all hover:scale-105 active:scale-95"
          >
            <Plus size={18} className="mr-2" /> Nouveau Véhicule
          </Button>
          <Button 
            onClick={() => { setRecordType("FRAI"); setRecordDialogOpen(true); }}
            className="rounded-2xl h-12 px-6 font-black bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-200 transition-all hover:scale-105 active:scale-95"
          >
            <Truck size={18} className="mr-2" /> Nouveau Frais
          </Button>
          <Button 
            onClick={() => { setRecordType("DEPENSE"); setRecordDialogOpen(true); }}
            className="rounded-2xl h-12 px-6 font-black bg-rose-600 hover:bg-rose-700 shadow-xl shadow-rose-200 transition-all hover:scale-105 active:scale-95"
          >
            <Wrench size={18} className="mr-2" /> Nouvelle Dépense
          </Button>
          <Button 
            variant="outline"
            onClick={() => setPrintModalOpen(true)}
            className="rounded-2xl h-12 px-6 font-black border-slate-200 hover:bg-slate-50 transition-all shadow-sm"
          >
            <Printer size={18} className="mr-2 text-slate-500" /> Rapports
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: "Véhicules Actifs", value: stats.total_vehicles, icon: Car, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100" },
            { label: "Valeur Flotte", value: `${new Intl.NumberFormat().format(stats.total_value)} F`, icon: Wallet, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
            { label: "Alertes Docs", value: stats.alerts, icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
            { label: "Dépenses Totales", value: `${new Intl.NumberFormat().format(stats.total_expenses)} F`, icon: Wrench, color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-100" },
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
        <Tabs defaultValue="vehicles" className="w-full" onValueChange={setActiveTab}>
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
            <TabsList className="bg-slate-100/80 p-1.5 rounded-2xl h-14 w-full lg:w-auto">
              <TabsTrigger value="vehicles" className="rounded-xl px-8 h-11 font-black text-xs uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:shadow-md transition-all">
                🚙 Voitures
              </TabsTrigger>
              <TabsTrigger value="fees" className="rounded-xl px-8 h-11 font-black text-xs uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:shadow-md transition-all">
                🚚 Frais de Transport
              </TabsTrigger>
              <TabsTrigger value="expenses" className="rounded-xl px-8 h-11 font-black text-xs uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:shadow-md transition-all">
                🔧 Dépenses
              </TabsTrigger>
            </TabsList>

            <form onSubmit={handleSearch} className="flex items-center gap-3 w-full lg:w-96">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
                <Input 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-12 pl-12 rounded-2xl border-slate-100 bg-slate-50/50 focus:bg-white transition-all font-bold"
                  placeholder="Rechercher..."
                />
              </div>
              <Button type="submit" variant="outline" className="h-12 w-12 rounded-2xl border-slate-200">
                <Filter size={18} />
              </Button>
            </form>
          </div>

          <TabsContent value="vehicles" className="mt-0">
            <div className="rounded-[32px] border border-slate-100 overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow className="hover:bg-transparent border-slate-100">
                    <TableHead className="font-black text-slate-400 uppercase text-[10px] tracking-widest px-6 h-14">Matricule</TableHead>
                    <TableHead className="font-black text-slate-400 uppercase text-[10px] tracking-widest h-14">Véhicule</TableHead>
                    <TableHead className="font-black text-slate-400 uppercase text-[10px] tracking-widest h-14">Chauffeur</TableHead>
                    <TableHead className="font-black text-slate-400 uppercase text-[10px] tracking-widest h-14 text-center">Statut Docs</TableHead>
                    <TableHead className="font-black text-slate-400 uppercase text-[10px] tracking-widest h-14 text-right pr-8">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="h-60 text-center"><Loader2 className="animate-spin mx-auto text-indigo-500" size={40} /></TableCell></TableRow>
                  ) : vehicles.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="h-60 text-center text-slate-400 font-bold">Aucun véhicule trouvé.</TableCell></TableRow>
                  ) : vehicles.map((v) => {
                    const status = getDocStatus(v);
                    return (
                      <TableRow key={v.id} className="hover:bg-slate-50/30 transition-colors border-slate-50">
                        <TableCell className="px-6 py-5">
                          <div className="font-black text-slate-900 flex items-center gap-2">
                            <Hash size={14} className="text-slate-300" /> {v.matricule}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-bold text-slate-700">{v.marque}</div>
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{v.modele} ({v.annee})</div>
                        </TableCell>
                        <TableCell className="font-bold text-slate-600 italic">
                          {v.chauffeur || "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm ${status.color}`}>
                            {status.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right pr-6 space-x-2">
                          <Button variant="ghost" size="icon" onClick={() => { setSelectedVehicle(v); setVehicleDialogOpen(true); }} className="h-10 w-10 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 text-slate-400 transition-all">
                            <Edit3 size={18} />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteVehicle(v.id)} className="h-10 w-10 rounded-xl hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition-all">
                            <Trash2 size={18} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="fees" className="mt-0">
            {/* Similar structure for Transport Fees */}
            <div className="rounded-[32px] border border-slate-100 overflow-hidden">
               <Table>
                 <TableHeader className="bg-slate-50/50">
                    <TableRow className="hover:bg-transparent border-slate-100">
                      <TableHead className="font-black text-slate-400 uppercase text-[10px] tracking-widest px-6 h-14">Date</TableHead>
                      <TableHead className="font-black text-slate-400 uppercase text-[10px] tracking-widest h-14">Véhicule</TableHead>
                      <TableHead className="font-black text-slate-400 uppercase text-[10px] tracking-widest h-14">Destination</TableHead>
                      <TableHead className="font-black text-slate-400 uppercase text-[10px] tracking-widest h-14">Marchandise</TableHead>
                      <TableHead className="font-black text-slate-400 uppercase text-[10px] tracking-widest h-14 text-right pr-8">Montant</TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {records.filter(r => r.record_type === "FRAI").map((r) => (
                      <TableRow key={r.id} className="hover:bg-slate-50/30 transition-colors border-slate-50">
                        <TableCell className="px-6 py-4 font-bold text-slate-600">{new Date(r.record_date).toLocaleDateString()}</TableCell>
                        <TableCell className="font-black text-slate-900">{r.voitures?.matricule}</TableCell>
                        <TableCell className="font-bold text-slate-600">{r.destination || "—"}</TableCell>
                        <TableCell className="text-xs font-medium text-slate-500">{r.cargo_details || "—"}</TableCell>
                        <TableCell className="text-right pr-8 font-black text-emerald-600">{new Intl.NumberFormat().format(r.amount)} F</TableCell>
                      </TableRow>
                    ))}
                 </TableBody>
               </Table>
            </div>
          </TabsContent>

          <TabsContent value="expenses" className="mt-0">
             {/* Similar structure for Expenses */}
             <div className="rounded-[32px] border border-slate-100 overflow-hidden">
               <Table>
                 <TableHeader className="bg-slate-50/50">
                    <TableRow className="hover:bg-transparent border-slate-100">
                      <TableHead className="font-black text-slate-400 uppercase text-[10px] tracking-widest px-6 h-14">Date</TableHead>
                      <TableHead className="font-black text-slate-400 uppercase text-[10px] tracking-widest h-14">Véhicule</TableHead>
                      <TableHead className="font-black text-slate-400 uppercase text-[10px] tracking-widest h-14">Catégorie</TableHead>
                      <TableHead className="font-black text-slate-400 uppercase text-[10px] tracking-widest h-14">Notes</TableHead>
                      <TableHead className="font-black text-slate-400 uppercase text-[10px] tracking-widest h-14 text-right pr-8">Montant</TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {records.filter(r => r.record_type === "DEPENSE").map((r) => (
                      <TableRow key={r.id} className="hover:bg-slate-50/30 transition-colors border-slate-50">
                        <TableCell className="px-6 py-4 font-bold text-slate-600">{new Date(r.record_date).toLocaleDateString()}</TableCell>
                        <TableCell className="font-black text-slate-900">{r.voitures?.matricule}</TableCell>
                        <TableCell>
                          <span className="px-3 py-1 rounded-lg bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-wider">{r.category}</span>
                        </TableCell>
                        <TableCell className="text-xs font-medium text-slate-500 max-w-[200px] truncate">{r.notes || "—"}</TableCell>
                        <TableCell className="text-right pr-8 font-black text-rose-600">{new Intl.NumberFormat().format(r.amount)} F</TableCell>
                      </TableRow>
                    ))}
                 </TableBody>
               </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <VehicleFormDialog 
        open={vehicleDialogOpen} 
        onClose={() => setVehicleDialogOpen(false)} 
        onSuccess={fetchData} 
        vehicle={selectedVehicle} 
      />

      <RecordFormDialog 
        open={recordDialogOpen} 
        onClose={() => setRecordDialogOpen(false)} 
        onSuccess={fetchData} 
        type={recordType} 
        vehicles={vehicles}
      />

      <VehiclePrintModal 
        open={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        vehicles={vehicles}
      />
    </div>
  );
}
