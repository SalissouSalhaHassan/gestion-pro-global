import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth_helper';
import { redeemLoyaltyPoints } from '@/lib/services/loyalty.service';

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const { client_id, invoice_id, points } = body;

    if (!client_id || !points || Number(points) <= 0) {
      return NextResponse.json({ error: "Client et points requis" }, { status: 400 });
    }

    const result = await redeemLoyaltyPoints(client_id, invoice_id, Number(points));
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Loyalty redeem error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
