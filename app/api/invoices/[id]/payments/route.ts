import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession, isAdminOrManager } from "@/lib/auth_helper";
import { applyUserScope } from "@/lib/utils/scoping";

export async function GET(
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

  // Multi-tenant organization check: ensure invoice belongs to user's organization
  const orgId = session.organization_id;
  let query = supabase.from("factures").select("id, organization_id").eq("id", invoiceId);
  if (orgId) {
    query = query.eq("organization_id", orgId);
  }
  const { data: inv, error: invErr } = await query.maybeSingle();
  if (invErr || !inv) {
    return NextResponse.json({ error: "Facture introuvable ou accès refusé" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("paiements")
    .select("*")
    .eq("facture_id", invoiceId)
    .order("date_operation", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

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

  // Multi-tenant organization check: ensure invoice belongs to user's organization
  const orgId = session.organization_id;
  let query = supabase.from("factures").select("id, organization_id, total_ttc").eq("id", invoiceId);
  if (orgId) {
    query = query.eq("organization_id", orgId);
  }
  const { data: inv, error: invErr } = await query.maybeSingle();
  if (invErr || !inv) {
    return NextResponse.json({ error: "Facture introuvable ou accès refusé" }, { status: 403 });
  }

  const body = await request.json();

  const {
    montant_regle,
    moyen_reglement,
    date_operation,
    reference_paiement,
    banque,
    date_echeance,
    proprietaire_cheque,
    notes
  } = body;

  // 1. Get current Authenticated User from custom session
  let dbUserId = Number(session.id) || null;
  let utilisateur = session.username || "Caisse";

  if (session.id) {
    const { data: userData } = await supabase
      .from("users")
      .select("id, utilisateur")
      .eq("id", session.id)
      .maybeSingle();
    
    if (userData) {
      dbUserId = userData.id;
      utilisateur = userData.utilisateur;
    }
  }

  // 2. Insert the payment
  const { data: payment, error: pError } = await supabase
    .from("paiements")
    .insert([
      {
        facture_id: invoiceId,
        montant_regle,
        moyen_reglement,
        date_operation: date_operation || new Date().toISOString().split("T")[0],
        reference_paiement: reference_paiement || null,
        banque: banque || null,
        date_echeance: date_echeance || null,
        proprietaire_cheque: proprietaire_cheque || null,
        notes: notes || null,
        user_id: dbUserId,
        utilisateur: utilisateur,
        regle: true
      }
    ])
    .select()
    .single();

  if (pError) {
    console.error("Payment Insert Error:", pError);
    return NextResponse.json({ error: pError.message }, { status: 500 });
  }

  // 3. Recalculate Invoice Totals
  const { data: allPayments, error: fetchError } = await supabase
    .from("paiements")
    .select("montant_regle, moyen_reglement")
    .eq("facture_id", invoiceId);

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  const totalPaid = allPayments
    .filter(p => {
      const mode = (p.moyen_reglement || "").toLowerCase();
      return !mode.includes('redit');
    })
    .reduce((acc, curr) => acc + Number(curr.montant_regle), 0);

  // Get invoice total_ttc
  const { data: invoice, error: iError } = await supabase
    .from("factures")
    .select("total_ttc")
    .eq("id", invoiceId)
    .single();

  if (iError) return NextResponse.json({ error: iError.message }, { status: 500 });

  const totalTtc = Number(invoice.total_ttc);
  const remaining = Math.max(0, totalTtc - totalPaid);
  const status = remaining <= 0 ? "Payée" : totalPaid > 0 ? "Partiellement Payée" : "Non Payée";

  // 4. Update Invoice
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
