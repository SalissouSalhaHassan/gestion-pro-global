import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PurchaseService } from '@/lib/services/purchase.service';
import { getServerSession } from '@/lib/auth_helper';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = {
      ref: searchParams.get('ref'),
      supplier: searchParams.get('supplier'),
      start_date: searchParams.get('start_date'),
      end_date: searchParams.get('end_date'),
    };

    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const purchaseService = new PurchaseService(supabase);
    const purchases = await purchaseService.getPurchases(session, filters);
    
    return NextResponse.json(purchases);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const purchaseService = new PurchaseService(supabase);
    
    if (!body.fournisseur_id || !body.items || body.items.length === 0) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 });
    }

    const newPurchase = await purchaseService.createPurchase(body, Number(session.id), session.username, session);
    return NextResponse.json(newPurchase, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
