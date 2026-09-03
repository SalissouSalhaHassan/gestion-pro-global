import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { InvoiceService } from '@/lib/services/invoice.service';
import { getServerSession, isAdminOrManager } from '@/lib/auth_helper';
import { applyUserScope } from '@/lib/utils/scoping';
import { logAuditEvent } from '@/lib/services/audit.service';

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
    
    // Admins see everything, Sellers only their own (scoping handled in service)
    const invoice = await invoiceService.getInvoiceById(Number(id), session);
    
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
    
    // Ownership check using centralized scoping
    if (!isAdmin) {
      let query = supabase.from("factures").select("id").eq("id", id);
      query = applyUserScope(query as any, session, 'factures');
      const { data: inv } = await query.single();
      if (!inv) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
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
    
    // Ownership check using centralized scoping
    if (!isAdmin) {
      let query = supabase.from("factures").select("id").eq("id", id);
      query = applyUserScope(query as any, session, 'factures');
      const { data: inv } = await query.single();
      if (!inv) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
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

    await logAuditEvent({
      action_type: "DELETE_INVOICE",
      severity: "CRITICAL",
      module: "VENTES",
      description: `Suppression définitive / Annulation de la facture #${id} par ${session.username}`,
      target_id: id,
      user_id: Number(session.id),
      username: session.username,
      metadata: { invoice_id: id },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
