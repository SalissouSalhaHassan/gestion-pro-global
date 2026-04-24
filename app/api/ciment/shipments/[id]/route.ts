import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession, isAdminOrManager } from "@/lib/auth_helper";

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const user = await getServerSession();
    
    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const isAdmin = await isAdminOrManager(user);
    if (!isAdmin) {
      return NextResponse.json({ error: "Action réservée aux administrateurs" }, { status: 403 });
    }

    const shipmentId = params.id;
    if (!shipmentId) {
      return NextResponse.json({ error: "ID manquant" }, { status: 400 });
    }

    // Optional: We might need to check if there are payments associated, 
    // or if the DB has cascade delete setup. The desktop app just deleted it directly.
    const { error } = await supabase
      .from("gestion_ciment")
      .delete()
      .eq("id", shipmentId);

    if (error) throw error;

    return NextResponse.json({ success: true, message: "Chargement supprimé avec succès." });

  } catch (error: any) {
    console.error("Ciment Shipment DELETE Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
