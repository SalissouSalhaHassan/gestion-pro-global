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
  Car, Hash, User, Calendar, Droplets, Gauge, 
  CreditCard, Palette, Settings2, Loader2, Save
} from "lucide-react";
// import { toast } from "sonner";
const toast = {
  error: (msg: string) => alert(msg),
  success: (msg: string) => alert(msg)
};

type VehicleFormDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vehicle?: any;
};

export default function VehicleFormDialog({ open, onClose, onSuccess, vehicle }: VehicleFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>({
    matricule: "",
    marque: "",
    modele: "",
    annee: "",
    chauffeur: "",
    chassis: "",
    couleur: "",
    carburant: "Diesel",
    transmission: "Manuelle",
    moteur: "",
    kilometrage: "",
    niveau_huile: "Normal",
    prix_achat: "",
    notes: ""
  });

  useEffect(() => {
    if (vehicle) {
      setFormData(vehicle);
    } else {
      setFormData({
        matricule: "",
        marque: "",
        modele: "",
        annee: "",
        chauffeur: "",
        chassis: "",
        couleur: "",
        carburant: "Diesel",
        transmission: "Manuelle",
        moteur: "",
        kilometrage: "",
        niveau_huile: "Normal",
        prix_achat: "",
        notes: ""
      });
    }
  }, [vehicle, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.matricule) {
      toast.error("Le matricule est obligatoire");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error("Erreur lors de l'enregistrement");
      
      toast.success(vehicle ? "Véhicule mis à jour" : "Véhicule créé avec succès");
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto bg-gradient-to-br from-white via-slate-50/80 to-indigo-50/20 border-white/60 backdrop-blur-2xl shadow-2xl rounded-[28px] p-0">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="px-8 pt-8 pb-4 border-b border-slate-100">
            <DialogTitle className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl shadow-lg shadow-indigo-500/30 text-white">
                <Car size={24} />
              </div>
              {vehicle ? "Modifier le Véhicule" : "Ajouter un Véhicule"}
            </DialogTitle>
            <DialogDescription className="text-slate-500 font-medium">
              Remplissez les informations techniques et administratives du véhicule.
            </DialogDescription>
          </DialogHeader>

          <div className="p-8 space-y-8">
            {/* Section: Identité */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-indigo-600 font-bold uppercase text-[10px] tracking-widest pb-2 border-b border-indigo-50">
                <Hash size={14} /> Identité du Véhicule
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-black text-slate-500 uppercase ml-1">Matricule *</Label>
                  <Input 
                    value={formData.matricule}
                    onChange={(e) => setFormData({ ...formData, matricule: e.target.value })}
                    className="h-12 rounded-xl border-slate-200 bg-white/50 focus:bg-white transition-all font-bold" 
                    placeholder="ABC-1234"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black text-slate-500 uppercase ml-1">Marque</Label>
                  <Input 
                    value={formData.marque}
                    onChange={(e) => setFormData({ ...formData, marque: e.target.value })}
                    className="h-12 rounded-xl border-slate-200 bg-white/50 focus:bg-white transition-all font-bold"
                    placeholder="Toyota, Mercedes..."
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black text-slate-500 uppercase ml-1">Modèle</Label>
                  <Input 
                    value={formData.modele}
                    onChange={(e) => setFormData({ ...formData, modele: e.target.value })}
                    className="h-12 rounded-xl border-slate-200 bg-white/50 focus:bg-white transition-all font-bold"
                    placeholder="Hilux, Sprinter..."
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black text-slate-500 uppercase ml-1">Année</Label>
                  <Input 
                    value={formData.annee}
                    onChange={(e) => setFormData({ ...formData, annee: e.target.value })}
                    className="h-12 rounded-xl border-slate-200 bg-white/50 focus:bg-white transition-all font-bold"
                    placeholder="2022"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black text-slate-500 uppercase ml-1">Chauffeur</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3.5 text-slate-400" size={18} />
                    <Input 
                      value={formData.chauffeur}
                      onChange={(e) => setFormData({ ...formData, chauffeur: e.target.value })}
                      className="h-12 pl-10 rounded-xl border-slate-200 bg-white/50 focus:bg-white transition-all font-bold"
                      placeholder="Nom du chauffeur"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black text-slate-500 uppercase ml-1">Prix d'achat (F)</Label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-3.5 text-slate-400" size={18} />
                    <Input 
                      type="number"
                      value={formData.prix_achat}
                      onChange={(e) => setFormData({ ...formData, prix_achat: e.target.value })}
                      className="h-12 pl-10 rounded-xl border-slate-200 bg-white/50 focus:bg-white transition-all font-bold"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section: Spécifications */}
            <div className="space-y-4 pt-4">
              <div className="flex items-center gap-2 text-emerald-600 font-bold uppercase text-[10px] tracking-widest pb-2 border-b border-emerald-50">
                <Settings2 size={14} /> Spécifications Techniques
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-black text-slate-500 uppercase ml-1">Carburant</Label>
                  <Select 
                    value={formData.carburant} 
                    onValueChange={(v) => setFormData({ ...formData, carburant: v })}
                  >
                    <SelectTrigger className="h-12 rounded-xl border-slate-200 bg-white/50 font-bold transition-all">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Essence">Essence</SelectItem>
                      <SelectItem value="Diesel">Diesel</SelectItem>
                      <SelectItem value="Hybride">Hybride</SelectItem>
                      <SelectItem value="Électrique">Électrique</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black text-slate-500 uppercase ml-1">Transmission</Label>
                  <Select 
                    value={formData.transmission} 
                    onValueChange={(v) => setFormData({ ...formData, transmission: v })}
                  >
                    <SelectTrigger className="h-12 rounded-xl border-slate-200 bg-white/50 font-bold transition-all">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Manuelle">Manuelle</SelectItem>
                      <SelectItem value="Automatique">Automatique</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black text-slate-500 uppercase ml-1">Niveau d'huile</Label>
                  <div className="relative">
                    <Droplets className="absolute left-3 top-3.5 text-slate-400" size={18} />
                    <Select 
                      value={formData.niveau_huile} 
                      onValueChange={(v) => setFormData({ ...formData, niveau_huile: v })}
                    >
                      <SelectTrigger className="h-12 pl-10 rounded-xl border-slate-200 bg-white/50 font-bold transition-all">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Normal">Normal</SelectItem>
                        <SelectItem value="Bas">Bas</SelectItem>
                        <SelectItem value="À vérifier">À vérifier</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black text-slate-500 uppercase ml-1">Kilométrage (KM)</Label>
                  <div className="relative">
                    <Gauge className="absolute left-3 top-3.5 text-slate-400" size={18} />
                    <Input 
                      value={formData.kilometrage}
                      onChange={(e) => setFormData({ ...formData, kilometrage: e.target.value })}
                      className="h-12 pl-10 rounded-xl border-slate-200 bg-white/50 focus:bg-white transition-all font-bold"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black text-slate-500 uppercase ml-1">Couleur</Label>
                  <div className="relative">
                    <Palette className="absolute left-3 top-3.5 text-slate-400" size={18} />
                    <Input 
                      value={formData.couleur}
                      onChange={(e) => setFormData({ ...formData, couleur: e.target.value })}
                      className="h-12 pl-10 rounded-xl border-slate-200 bg-white/50 focus:bg-white transition-all font-bold"
                      placeholder="Blanc, Noir..."
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black text-slate-500 uppercase ml-1">N° Châssis (VIN)</Label>
                  <Input 
                    value={formData.chassis}
                    onChange={(e) => setFormData({ ...formData, chassis: e.target.value })}
                    className="h-12 rounded-xl border-slate-200 bg-white/50 focus:bg-white transition-all font-bold"
                    placeholder="VIN Number"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2 pt-4">
              <Label className="text-xs font-black text-slate-500 uppercase ml-1">Notes & Observations</Label>
              <Textarea 
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="min-h-[100px] rounded-2xl border-slate-200 bg-white/50 focus:bg-white transition-all font-medium"
                placeholder="Historique, état général, etc."
              />
            </div>
          </div>

          <DialogFooter className="px-8 py-6 bg-slate-50/50 border-t border-slate-100 rounded-b-[28px] gap-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              className="h-12 rounded-2xl border-slate-200 px-6 font-bold hover:bg-white"
            >
              Annuler
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="h-12 rounded-2xl px-8 font-black bg-gradient-to-r from-indigo-600 to-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-indigo-200"
            >
              {loading ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" size={18} />}
              Enregistrer le Véhicule
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
