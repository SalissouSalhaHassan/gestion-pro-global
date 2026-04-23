import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession, isAdminOrManager } from "@/lib/auth_helper";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id: rawId } = await params;
  const invoiceId = parseInt(rawId);

  if (isNaN(invoiceId)) {
    return NextResponse.json({ error: `ID de facture invalide: ${rawId}` }, { status: 400 });
  }

  // Ownership check
  const isAdmin = await isAdminOrManager(session);
  if (!isAdmin) {
    const { data: inv } = await supabase
      .from("factures")
      .select("user_id, created_by, vendeur")
      .eq("id", invoiceId)
      .single();
    
    const isOwner = inv && (
      String(inv.user_id) === String(session.id) || 
      String(inv.created_by) === String(session.id) || 
      inv.vendeur === session.username
    );

    if (!isOwner) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
  }

  const body = await request.json();

  const { advance_id, amount, user_id } = body;

  if (!advance_id || !amount) {
    return NextResponse.json({ error: "Advance ID and amount are required" }, { status: 400 });
  }

  // 1. Verify Advance availability
  const { data: advance, error: advError } = await supabase
    .from("avances_clients")
    .select("montant_restant")
    .eq("id", advance_id)
    .single();

  if (advError) return NextResponse.json({ error: advError.message }, { status: 500 });

  if (Number(advance.montant_restant) < Number(amount)) {
    return NextResponse.json({ error: "Solde d'avance insuffisant" }, { status: 400 });
  }

  // 2. Insert Payment record linked to advance
  const { data: payment, error: pError } = await supabase
    .from("paiements")
    .insert([
      {
        facture_id: invoiceId,
        montant_regle: amount,
        moyen_reglement: "Avance",
        date_operation: new Date().toISOString().split("T")[0],
        avance_client_id: advance_id,
        regle: true,
        user_id: user_id || null
      }
    ])
    .select()
    .single();

  if (pError) return NextResponse.json({ error: pError.message }, { status: 500 });

  // 3. Update Advance balance
  const newAdvRemaining = Math.max(0, Number(advance.montant_restant) - Number(amount));
  const advStatus = newAdvRemaining <= 0 ? "Utilisée" : "Disponible";

  const { error: uAdvError } = await supabase
    .from("avances_clients")
    .update({
      montant_restant: newAdvRemaining,
      statut: advStatus
    })
    .eq("id", advance_id);

  if (uAdvError) return NextResponse.json({ error: uAdvError.message }, { status: 500 });

  // 4. Update Invoice Totals
  const { data: allPayments, error: fetchError } = await supabase
    .from("paiements")
    .select("montant_regle")
    .eq("facture_id", invoiceId);

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  const totalPaid = allPayments.reduce((acc, curr) => acc + Number(curr.montant_regle), 0);

  const { data: invoice, error: iError } = await supabase
    .from("factures")
    .select("total_ttc")
    .eq("id", invoiceId)
    .single();

  if (iError) return NextResponse.json({ error: iError.message }, { status: 500 });

  const totalTtc = Number(invoice.total_ttc);
  const remaining = Math.max(0, totalTtc - totalPaid);
  const status = remaining <= 0 ? "Payée" : totalPaid > 0 ? "Partiellement Payée" : "Non Payée";

  const { error: uError } = await supabase
    .from("factures")
    .update({
      montant_paye: totalPaid,
      montant_restant: remaining,
      statut: status
    })
    .eq("id", invoiceId);

  if (uError) return NextResponse.json({ error: uError.message }, { status: 500 });

  return NextResponse.json({ success: true, payment });
}
