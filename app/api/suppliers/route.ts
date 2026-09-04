import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SupplierService } from '@/lib/services/supplier.service';
import { getServerSession } from '@/lib/auth_helper';

export async function GET() {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const supplierService = new SupplierService(supabase);
    const suppliers = await supplierService.getSuppliers(session);
    
    return NextResponse.json(suppliers);
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
    const supplierService = new SupplierService(supabase);
    
    if (!body.nom) {
      return NextResponse.json({ error: 'Le nom est obligatoire' }, { status: 400 });
    }

    const newSupplier = await supplierService.createSupplier(body, session);
    return NextResponse.json(newSupplier, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
