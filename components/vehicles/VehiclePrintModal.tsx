"use client";

import { useState } from "react";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Printer, FileText, Download, Loader2, Calendar, Filter
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { toast } from "sonner";

type VehiclePrintModalProps = {
  open: boolean;
  onClose: () => void;
  vehicles: any[];
};

export default function VehiclePrintModal({ open, onClose, vehicles }: VehiclePrintModalProps) {
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState("fleet");
  const [vehicleId, setVehicleId] = useState("all");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  const handlePrint = async () => {
    setLoading(true);
    try {
      // Simulate a print route call or open a window
      const url = `/api/vehicles/print?type=${reportType}&vehicleId=${vehicleId}&start=${dateRange.start}&end=${dateRange.end}`;
      window.open(url, "_blank");
      onClose();
    } catch (error) {
      toast.error("Erreur de génération du rapport");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md bg-white rounded-[32px] p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-8 pb-4 bg-slate-50/50">
          <DialogTitle className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 rounded-xl shadow-lg text-white">
              <Printer size={24} />
            </div>
            Générer un Rapport
          </DialogTitle>
          <DialogDescription className="text-slate-500 font-medium">
            Sélectionnez les critères pour le rapport PDF/Impression.
          </DialogDescription>
        </DialogHeader>

        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <Label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Type de Rapport</Label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger className="h-12 rounded-xl border-slate-100 bg-slate-50/50 font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fleet">🚗 État de la Flotte (Général)</SelectItem>
                <SelectItem value="fees">🚚 Rapport des Transports</SelectItem>
                <SelectItem value="expenses">🔧 Rapport des Dépenses</SelectItem>
                <SelectItem value="individual">📋 Fiche Individuelle par Véhicule</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(reportType === "individual" || reportType === "fees" || reportType === "expenses") && (
            <div className="space-y-2">
              <Label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Véhicule</Label>
              <Select value={vehicleId} onValueChange={setVehicleId}>
                <SelectTrigger className="h-12 rounded-xl border-slate-100 bg-slate-50/50 font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les véhicules</SelectItem>
                  {vehicles.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.matricule}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(reportType === "fees" || reportType === "expenses") && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Début</Label>
                <Input 
                  type="date" 
                  value={dateRange.start} 
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="h-12 rounded-xl border-slate-100 bg-slate-50/50 font-bold"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Fin</Label>
                <Input 
                  type="date" 
                  value={dateRange.end} 
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="h-12 rounded-xl border-slate-100 bg-slate-50/50 font-bold"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-8 pt-0 flex flex-col gap-2">
          <Button 
            onClick={handlePrint}
            disabled={loading}
            className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 font-black text-lg shadow-xl shadow-indigo-100 transition-all active:scale-95"
          >
            {loading ? <Loader2 className="animate-spin mr-2" /> : <Download className="mr-2" size={20} />}
            Générer le PDF
          </Button>
          <Button 
            variant="ghost" 
            onClick={onClose}
            className="w-full h-12 rounded-xl font-bold text-slate-400 hover:bg-slate-50"
          >
            Annuler
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
