import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession, isAdminOrManager } from "@/lib/auth_helper";

// GET: Fetch expenses with filters
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getServerSession();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const isAdmin = await isAdminOrManager(user);
    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const oper = searchParams.get("oper");

    let query = supabase
      .from("depenses")
      .select("*")
      .order("date_depense", { ascending: false })
      .order("id", { ascending: false });

    // Filter by depot/emplacement for non-admin users instead of created_by
    if (!isAdmin && user.emplacement) {
      query = query.eq("emplacement", user.emplacement);
    }

    if (start) query = query.gte("date_depense", start);
    if (end) query = query.lte("date_depense", end);
    if (oper && oper !== "Tous") query = query.eq("operateur", oper);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Create or Update an expense
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getServerSession();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const { id, date_depense, no_caisse, libelle, operateur, montant, autorise_par } = body;

    if (!date_depense || !montant) {
      return NextResponse.json({ error: "Date et montant requis" }, { status: 400 });
    }

    const expenseData: any = {
      date_depense,
      no_caisse,
      libelle,
      operateur,
      montant,
      autorise_par,
      updated_at: new Date().toISOString()
    };
    
    // Automatically attach the user's emplacement for scoping if they aren't admin
    const isAdmin = await isAdminOrManager(user);
    if (!isAdmin && user.emplacement) {
      expenseData.emplacement = user.emplacement;
    }

    if (id) {
      const isAdmin = await isAdminOrManager(user);
      
      // Non-admins can only edit if they own the depot record
      if (!isAdmin) {
        const { data: existing } = await supabase
          .from("depenses")
          .select("emplacement")
          .eq("id", id)
          .single();
        
        if (existing?.emplacement && existing.emplacement !== user.emplacement) {
          return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        }
      }

      const { data, error } = await supabase
        .from("depenses")
        .update(expenseData)
        .eq("id", id)
        .select();
      
      if (error) throw error;
      return NextResponse.json({ message: "Dépense mise à jour", data });
    } else {
      const { data, error } = await supabase
        .from("depenses")
        .insert([expenseData])
        .select();

      if (error) throw error;
      return NextResponse.json({ message: "Dépense créée", data });
    }
  } catch (error: any) {
    console.error("POST /api/expenses error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Remove an expense
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getServerSession();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

    const isAdmin = await isAdminOrManager(user);
    if (!isAdmin) {
      const { data: existing } = await supabase
        .from("depenses")
        .select("emplacement")
        .eq("id", id)
        .single();

      if (existing?.emplacement && existing.emplacement !== user.emplacement) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    const { error } = await supabase
      .from("depenses")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ message: "Dépense supprimée" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
