import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { InvoiceService } from '@/lib/services/invoice.service';
import { getServerSession, isAdminOrManager } from '@/lib/auth_helper';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const isAdmin = await isAdminOrManager(session);
    const invoiceService = new InvoiceService(supabase);
    
    // Admins see everything, Sellers only their own
    const invoice = await invoiceService.getInvoiceById(Number(id), isAdmin ? undefined : Number(session.id));
    
    if (!invoice) {
        return NextResponse.json({ error: "Facture introuvable ou accès refusé" }, { status: 404 });
    }

    return NextResponse.json(invoice);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const isAdmin = await isAdminOrManager(session);
    const body = await request.json();
    
    // Check if invoice exists and belongs to user if they are not admin
    const { data: existing, error: fetchError } = await supabase
        .from('factures')
        .select('user_id')
        .eq('id', id)
        .single();
    
    if (fetchError || !existing) {
        return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
    }

    if (!isAdmin && String(existing.user_id) !== String(session.id)) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('factures')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
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

    const isAdmin = await isAdminOrManager(session);
    
    // Check ownership
    const { data: existing, error: fetchError } = await supabase
        .from('factures')
        .select('user_id')
        .eq('id', id)
        .single();
    
    if (fetchError || !existing) {
        return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
    }

    if (!isAdmin && String(existing.user_id) !== String(session.id)) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Use the safe delete RPC to handle stock adjustment
    const { data: result, error: rpcError } = await supabase.rpc('delete_invoice_safe', { 
      p_invoice_id: Number(id),
      p_user_id: Number(session.id),
      p_username: session.username || 'System'
    });

    if (rpcError) {
        // Fallback to simple soft delete if RPC fails
        const { error: softErr } = await supabase
          .from("factures")
          .update({ is_deleted: true, deleted_at: new Date().toISOString() })
          .eq("id", id);
        
        if (softErr) throw softErr;
        return NextResponse.json({ ok: true, message: "Facture supprimée (soft delete fallback)" });
    }

    if (result && result.ok === false) {
        return NextResponse.json({ error: result.error || "Échec de la suppression" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
