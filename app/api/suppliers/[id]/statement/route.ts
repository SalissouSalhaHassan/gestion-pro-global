import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth_helper";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id: rawId } = await params;
    const supplierId = parseInt(rawId);

    if (isNaN(supplierId)) {
      return NextResponse.json({ error: `ID de fournisseur invalide: ${rawId}` }, { status: 400 });
    }

    // 1. Fetch Supplier Details
    const { data: supplier, error: suppErr } = await supabase
      .from("fournisseurs")
      .select("*")
      .eq("id", supplierId)
      .single();

    if (suppErr || !supplier) {
      return NextResponse.json({ error: "Fournisseur introuvable" }, { status: 404 });
    }

    // 2. Fetch Company Details
    const { data: company } = await supabase
      .from("informations_entreprise")
      .select("*")
      .maybeSingle();

    // 3. Fetch Supplier Purchases (Achats)
    const { data: achats, error: achatsErr } = await supabase
      .from("achats")
      .select("id, numero_facture, date_achat, montant_total, montant_paye, statut, notes, depot_nom")
      .or(`fournisseur_id.eq.${supplierId},fournisseur_nom.eq."${supplier.nom}"`)
      .order("date_achat", { ascending: true });

    if (achatsErr) throw new Error(achatsErr.message);

    // 4. Fetch Payments made for these purchases
    const achatIds = (achats || []).map((a: any) => a.id);
    let payments: any[] = [];
    if (achatIds.length > 0) {
      const { data: payData, error: payErr } = await supabase
        .from("paiements")
        .select("id, achat_id, date_operation, montant_regle, moyen_reglement, reference_paiement, utilisateur")
        .in("achat_id", achatIds)
        .order("date_operation", { ascending: true });

      if (!payErr && payData) {
        payments = payData;
      }
    }

    // 5. Build Unified Chronological Ledger
    // For a Supplier:
    // Invoice (Achat) increases what we owe = Débit / Facturé
    // Payment (Règlement) decreases what we owe = Crédit / Payé
    const rawEvents: any[] = [];

    // Add Purchases
    (achats || []).forEach((a: any) => {
      rawEvents.push({
        id: `ACH-${a.id}`,
        date: a.date_achat || new Date().toISOString().split("T")[0],
        ref: a.numero_facture || `ACH-${a.id}`,
        type: "Facture d'Achat",
        debit: Number(a.montant_total) || 0,
        credit: 0,
        notes: a.notes || `Dépôt: ${a.depot_nom || "Principal"}`,
        statut: a.statut,
      });
    });

    // Add Payments
    payments.forEach((p: any) => {
      const matchingAchat = (achats || []).find((a: any) => a.id === p.achat_id);
      rawEvents.push({
        id: `REG-${p.id}`,
        date: p.date_operation || new Date().toISOString().split("T")[0],
        ref: p.reference_paiement || `REG-${p.id}`,
        type: `Règlement (${p.moyen_reglement || "Espèces"})`,
        debit: 0,
        credit: Number(p.montant_regle) || 0,
        notes: matchingAchat ? `Sur facture ${matchingAchat.numero_facture}` : "Règlement fournisseur",
        user: p.utilisateur || "Comptabilité",
      });
    });

    // Sort chronologically ascending
    rawEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Compute running balance
    let runningBalance = 0;
    const ledger = rawEvents.map((evt) => {
      runningBalance += evt.debit - evt.credit;
      return {
        ...evt,
        solde: runningBalance,
      };
    });

    const totalFacture = (achats || []).reduce((sum: number, a: any) => sum + (Number(a.montant_total) || 0), 0);
    const totalRegle = payments.reduce((sum: number, p: any) => sum + (Number(p.montant_regle) || 0), 0);
    const soldeRestantDu = totalFacture - totalRegle;

    return NextResponse.json({
      supplier,
      company,
      summary: {
        totalFacture,
        totalRegle,
        soldeRestantDu,
        nombreAchats: (achats || []).length,
        nombreReglements: payments.length,
      },
      ledger,
    });
  } catch (error: any) {
    console.error("Supplier statement API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
