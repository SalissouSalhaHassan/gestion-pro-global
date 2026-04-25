"use client";

import { useState, useEffect } from "react";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { 
  Truck, Wrench, Wallet, Calendar, MapPin, Gauge, 
  Package, Hash, Loader2, Save
} from "lucide-react";
import { toast } from "sonner";

type RecordFormDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  type: "FRAI" | "DEPENSE";
  vehicles: any[];
  record?: any;
};

export default function RecordFormDialog({ open, onClose, onSuccess, type, vehicles, record }: RecordFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>({
    voiture_id: "",
    record_type: type,
    category: "",
    record_date: new Date().toISOString().split('T')[0],
    amount: "",
    notes: "",
    start_date: "",
    end_date: "",
    destination: "",
    km_departure: "",
    km_arrival: "",
    cargo_details: "",
    ref_number: ""
  });

  useEffect(() => {
    if (record) {
      setFormData(record);
    } else {
      setFormData({
        voiture_id: "",
        record_type: type,
        category: "",
        record_date: new Date().toISOString().split('T')[0],
        amount: "",
        notes: "",
        start_date: "",
        end_date: "",
        destination: "",
        km_departure: "",
        km_arrival: "",
        cargo_details: "",
        ref_number: ""
      });
    }
  }, [record, open, type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.voiture_id || !formData.amount || !formData.record_date) {
      toast.error("Veuillez remplir les champs obligatoires (*)");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/vehicles/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, record_type: type }),
      });

      if (!res.ok) throw new Error("Erreur lors de l'enregistrement");
      
      toast.success("Enregistrement réussi");
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const isSmartCategory = (cat: string) => {
    const k = cat.toLowerCase();
    return k.includes('assurance') || k.includes('vignette') || k.includes('taxe') || k.includes('vidange') || k.includes('maintenance');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto bg-gradient-to-br from-white via-slate-50/80 to-amber-50/10 border-white/60 backdrop-blur-2xl shadow-2xl rounded-[28px] p-0">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="px-8 pt-8 pb-4 border-b border-slate-100">
            <DialogTitle className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
              <div className={`p-2.5 rounded-xl shadow-lg text-white ${
                type === "FRAI" ? "bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/30" : "bg-gradient-to-br from-rose-500 to-red-600 shadow-rose-500/30"
              }`}>
                {type === "FRAI" ? <Truck size={24} /> : <Wrench size={24} />}
              </div>
              {type === "FRAI" ? "Nouveau Frais de Transport" : "Nouvelle Dépense"}
            </DialogTitle>
            <DialogDescription className="text-slate-500 font-medium">
              Saisie des détails de {type === "FRAI" ? "la course" : "la dépense"} pour le véhicule sélectionné.
            </DialogDescription>
          </DialogHeader>

          <div className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-500 uppercase ml-1">Véhicule *</Label>
                <Select 
                  value={formData.voiture_id} 
                  onValueChange={(v) => setFormData({ ...formData, voiture_id: v })}
                >
                  <SelectTrigger className="h-12 rounded-xl border-slate-200 bg-white/50 font-bold transition-all">
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.matricule} ({v.marque})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-500 uppercase ml-1">Catégorie</Label>
                <Input 
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="h-12 rounded-xl border-slate-200 bg-white/50 focus:bg-white transition-all font-bold"
                  placeholder={type === "FRAI" ? "Course, Livraison..." : "Carburant, Assurance, Vidange..."}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-500 uppercase ml-1">Montant (F) *</Label>
                <div className="relative">
                  <Wallet className="absolute left-3 top-3.5 text-slate-400" size={18} />
                  <Input 
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="h-12 pl-10 rounded-xl border-slate-200 bg-white/50 focus:bg-white transition-all font-bold"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-500 uppercase ml-1">Date *</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3.5 text-slate-400" size={18} />
                  <Input 
                    type="date"
                    value={formData.record_date}
                    onChange={(e) => setFormData({ ...formData, record_date: e.target.value })}
                    className="h-12 pl-10 rounded-xl border-slate-200 bg-white/50 focus:bg-white transition-all font-bold"
                  />
                </div>
              </div>
            </div>

            {type === "FRAI" && (
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-black text-slate-500 uppercase ml-1">Destination</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3.5 text-slate-400" size={18} />
                      <Input 
                        value={formData.destination}
                        onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                        className="h-12 pl-10 rounded-xl border-slate-200 bg-white/50 focus:bg-white transition-all font-bold"
                        placeholder="Ville ou Lieu"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-black text-slate-500 uppercase ml-1">Distance (KM)</Label>
                    <div className="relative">
                      <Gauge className="absolute left-3 top-3.5 text-slate-400" size={18} />
                      <Input 
                        type="number"
                        value={formData.km_arrival}
                        onChange={(e) => setFormData({ ...formData, km_arrival: e.target.value })}
                        className="h-12 pl-10 rounded-xl border-slate-200 bg-white/50 focus:bg-white transition-all font-bold"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-black text-slate-500 uppercase ml-1">Cargaison</Label>
                    <div className="relative">
                      <Package className="absolute left-3 top-3.5 text-slate-400" size={18} />
                      <Input 
                        value={formData.cargo_details}
                        onChange={(e) => setFormData({ ...formData, cargo_details: e.target.value })}
                        className="h-12 pl-10 rounded-xl border-slate-200 bg-white/50 focus:bg-white transition-all font-bold"
                        placeholder="Marchandise"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-black text-slate-500 uppercase ml-1">N° Réf / Bon</Label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-3.5 text-slate-400" size={18} />
                      <Input 
                        value={formData.ref_number}
                        onChange={(e) => setFormData({ ...formData, ref_number: e.target.value })}
                        className="h-12 pl-10 rounded-xl border-slate-200 bg-white/50 focus:bg-white transition-all font-bold"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {type === "DEPENSE" && isSmartCategory(formData.category) && (
              <div className="space-y-2 pt-4 border-t border-slate-100">
                <Label className="text-xs font-black text-rose-500 uppercase ml-1 tracking-wider">Date d'Expiration / Prochaine Échéance</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3.5 text-rose-400" size={18} />
                  <Input 
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="h-12 pl-10 rounded-xl border-rose-100 bg-rose-50/30 focus:bg-white transition-all font-bold"
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-medium ml-1 italic">Cette date mettra à jour automatiquement les alertes du véhicule.</p>
              </div>
            )}

            <div className="space-y-2 pt-4 border-t border-slate-100">
              <Label className="text-xs font-black text-slate-500 uppercase ml-1">Notes & Détails</Label>
              <Textarea 
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="min-h-[80px] rounded-2xl border-slate-200 bg-white/50 focus:bg-white transition-all font-medium"
                placeholder="..."
              />
            </div>
          </div>

          <DialogFooter className="px-8 py-6 bg-slate-50/50 border-t border-slate-100 rounded-b-[28px] gap-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              className="h-12 rounded-2xl border-slate-200 px-6 font-bold"
            >
              Annuler
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className={`h-12 rounded-2xl px-8 font-black transition-all shadow-xl ${
                type === "FRAI" ? "bg-amber-600 hover:bg-amber-700 shadow-amber-200" : "bg-rose-600 hover:bg-rose-700 shadow-rose-200"
              }`}
            >
              {loading ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" size={18} />}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
