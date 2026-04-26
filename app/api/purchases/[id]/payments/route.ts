import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PurchaseService } from '@/lib/services/purchase.service';
import { getServerSession } from '@/lib/auth_helper';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const purchaseService = new PurchaseService(supabase);
    
    if (!body.amount) {
      return NextResponse.json({ error: 'Montant manquant' }, { status: 400 });
    }

    const payment = await purchaseService.addPayment(
      Number(id),
      body.amount,
      body.method || 'Espèces',
      body.reference || '',
      Number(session.id),
      session.username
    );
    
    return NextResponse.json(payment, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
