import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id: paymentId } = await params;

  // 1. Get payment info to find facture_id
  const { data: payment, error: fetchPError } = await supabase
    .from("paiements")
    .select("facture_id")
    .eq("id", paymentId)
    .single();

  if (fetchPError) return NextResponse.json({ error: fetchPError.message }, { status: 500 });

  const invoiceId = payment.facture_id;

  // 2. Delete the payment
  const { error: dError } = await supabase
    .from("paiements")
    .delete()
    .eq("id", paymentId);

  if (dError) return NextResponse.json({ error: dError.message }, { status: 500 });

  // 3. Recalculate Invoice Totals
  const { data: allPayments, error: fetchAllError } = await supabase
    .from("paiements")
    .select("montant_regle")
    .eq("facture_id", invoiceId);

  if (fetchAllError) return NextResponse.json({ error: fetchAllError.message }, { status: 500 });

  const totalPaid = allPayments.reduce((acc, curr) => acc + Number(curr.montant_regle), 0);

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

  return NextResponse.json({ success: true });
}
