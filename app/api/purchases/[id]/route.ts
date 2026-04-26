import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PurchaseService } from '@/lib/services/purchase.service';
import { getServerSession } from '@/lib/auth_helper';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const purchaseService = new PurchaseService(supabase);
    const purchase = await purchaseService.getPurchaseById(Number(id), session);
    
    if (!purchase) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    return NextResponse.json(purchase);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const purchaseService = new PurchaseService(supabase);
    await purchaseService.deletePurchase(Number(id), Number(session.id), session.username);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
