import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { InvoiceService } from '@/lib/services/invoice.service';
import { getServerSession, isAdminOrManager } from '@/lib/auth_helper';

export async function GET() {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const isAdmin = await isAdminOrManager(session);
    const invoiceService = new InvoiceService(supabase);
    
    // Admin sees all, Seller sees only their own
    const invoices = await invoiceService.getInvoices(
      isAdmin ? undefined : Number(session.id), 
      session.username,
      session.emplacement
    );
    
    return NextResponse.json(invoices);
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
    const invoiceService = new InvoiceService(supabase);
    
    if (!body.client_id || !body.total_ht) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Automatically set created_by to session.id
    const newInvoice = await invoiceService.createInvoice(body, Number(session.id));
    return NextResponse.json(newInvoice, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

