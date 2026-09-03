import { createClient } from "@/lib/supabase/server";

export const POINTS_PER_CFA_RATIO = 1000; // 1,000 FCFA = 1 Point
export const CFA_PER_POINT_VALUE = 10;     // 1 Point = 10 FCFA discount (100 pts = 1,000 FCFA)

export type LoyaltyTier = "BRONZE" | "ARGENT" | "OR" | "PLATINE";

export function determineLoyaltyTier(points: number): LoyaltyTier {
  if (points >= 5000) return "PLATINE";
  if (points >= 1500) return "OR";
  if (points >= 500) return "ARGENT";
  return "BRONZE";
}

export function calculatePointsFromTotal(totalTTC: number): number {
  return Math.floor((Number(totalTTC) || 0) / POINTS_PER_CFA_RATIO);
}

export function calculateCFAFromPoints(points: number): number {
  return Math.floor((Number(points) || 0) * CFA_PER_POINT_VALUE);
}

export async function awardLoyaltyPoints(clientId: number | string, invoiceId: number | string, totalTTC: number) {
  try {
    const pointsToAward = calculatePointsFromTotal(totalTTC);
    if (pointsToAward <= 0) return { awarded: 0 };

    const supabase = await createClient();

    // 1. Fetch current client balance
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('id, points_fidelite')
      .eq('id', clientId)
      .single();

    if (clientErr || !client) return { error: "Client introuvable" };

    const newPointsTotal = (Number(client.points_fidelite) || 0) + pointsToAward;
    const newTier = determineLoyaltyTier(newPointsTotal);
    const equivalentCFA = calculateCFAFromPoints(pointsToAward);

    // 2. Insert transaction record
    await supabase.from('transactions_points_fidelite').insert({
      client_id: client.id,
      facture_id: invoiceId ? Number(invoiceId) : null,
      type_transaction: 'GAIN',
      points: pointsToAward,
      equivalent_fcfa: equivalentCFA,
      motif: `Achat Facture #${invoiceId} (${totalTTC.toLocaleString()} FCFA)`,
    });

    // 3. Update client balance & tier
    await supabase
      .from('clients')
      .update({
        points_fidelite: newPointsTotal,
        niveau_fidelite: newTier,
      })
      .eq('id', client.id);

    return { awarded: pointsToAward, newTotal: newPointsTotal, tier: newTier };
  } catch (e: any) {
    console.error("Failed to award loyalty points:", e);
    return { error: e.message };
  }
}

export async function redeemLoyaltyPoints(clientId: number | string, invoiceId: number | string, pointsToRedeem: number) {
  try {
    const supabase = await createClient();

    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('id, points_fidelite')
      .eq('id', clientId)
      .single();

    if (clientErr || !client) return { error: "Client introuvable" };

    const currentPoints = Number(client.points_fidelite) || 0;
    if (currentPoints < pointsToRedeem) {
      return { error: `Points insuffisants (Solde: ${currentPoints} pts, Demandé: ${pointsToRedeem} pts)` };
    }

    const discountCFA = calculateCFAFromPoints(pointsToRedeem);
    const newPointsTotal = currentPoints - pointsToRedeem;
    const newTier = determineLoyaltyTier(newPointsTotal);

    // Record redemption
    await supabase.from('transactions_points_fidelite').insert({
      client_id: client.id,
      facture_id: invoiceId ? Number(invoiceId) : null,
      type_transaction: 'UTILISATION',
      points: pointsToRedeem,
      equivalent_fcfa: discountCFA,
      motif: `Remise fidélité appliquée sur Facture #${invoiceId}`,
    });

    // Update client balance
    await supabase
      .from('clients')
      .update({
        points_fidelite: newPointsTotal,
        niveau_fidelite: newTier,
      })
      .eq('id', client.id);

    return {
      success: true,
      discountCFA,
      newPointsTotal,
      tier: newTier,
    };
  } catch (e: any) {
    console.error("Failed to redeem loyalty points:", e);
    return { error: e.message };
  }
}
