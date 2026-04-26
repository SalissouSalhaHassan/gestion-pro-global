import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SupplierService } from '@/lib/services/supplier.service';
import { getServerSession } from '@/lib/auth_helper';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const supplierService = new SupplierService(supabase);
    const supplier = await supplierService.getSupplierById(Number(params.id), session);
    
    if (!supplier) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    return NextResponse.json(supplier);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const supplierService = new SupplierService(supabase);
    
    const updated = await supplierService.updateSupplier(Number(params.id), body, Number(session.id));
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const supplierService = new SupplierService(supabase);
    await supplierService.deleteSupplier(Number(params.id), Number(session.id));
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
