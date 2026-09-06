import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServerSession } from "@/lib/auth_helper";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const orgId = session.organization_id || "00000000-0000-0000-0000-000000000001";
    const supabase = await createClient();

    // 1. Fetch organization company info
    const { data: comp, error } = await supabase
      .from("informations_entreprise")
      .select("*")
      .eq("organization_id", orgId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching company info:", error);
    }

    let companyData = comp;

    // 2. Auto-provision company profile if not yet created for this tenant
    if (!companyData) {
      const defaultName = session.organization_name || (session as any).nom_prenom || "Notre Entreprise";
      const { data: inserted, error: insertErr } = await supabase
        .from("informations_entreprise")
        .insert({
          organization_id: orgId,
          nom_entreprise: defaultName,
          adresse: "Maradi, Niger",
          telephone: "+227 00 00 00 00",
          email: "contact@entreprise.com",
          rc: "RCCM-NI-2026-A-001",
          nif: "12345/N",
          notes_pied_facture: "Merci pour votre confiance. Les marchandises vendues ne sont ni reprises ni échangées après 48h.",
        })
        .select()
        .single();

      if (!insertErr && inserted) {
        companyData = inserted;
      }
    }

    // 3. Extract branding and cachet preferences (support both native columns and resilient JSON fallback in capital_social)
    let branding: any = {
      brand_color: "#4f46e5",
      slogan: "Commerce Général & Import-Export",
      show_stamp: true,
      show_qr_code: true,
      cachet_url: null,
      invoice_visibility_policy: "shared",
    };

    if (companyData?.capital_social && companyData.capital_social.startsWith("{")) {
      try {
        const parsed = JSON.parse(companyData.capital_social);
        branding = { ...branding, ...parsed };
      } catch (e) {}
    }

    // Prefer native columns if present
    if (companyData?.cachet_url) branding.cachet_url = companyData.cachet_url;
    if (companyData?.brand_color) branding.brand_color = companyData.brand_color;
    if (companyData?.slogan) branding.slogan = companyData.slogan;
    if (typeof companyData?.show_stamp === "boolean") branding.show_stamp = companyData.show_stamp;
    if (typeof companyData?.show_qr_code === "boolean") branding.show_qr_code = companyData.show_qr_code;
    if (companyData?.invoice_visibility_policy) branding.invoice_visibility_policy = companyData.invoice_visibility_policy;

    return NextResponse.json({
      ok: true,
      company: {
        ...companyData,
        ...branding,
      },
    });
  } catch (err: any) {
    console.error("GET /api/settings/company error:", err);
    return NextResponse.json({ error: err.message || "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const orgId = session.organization_id || "00000000-0000-0000-0000-000000000001";
    const supabase = await createClient();
    const body = await req.json();

    let cachetUrl = body.cachet_url || null;

    // 1. Handle Cachet Image Upload to Supabase Storage if base64 file data provided
    if (body.cachet_file_base64 && typeof body.cachet_file_base64 === "string") {
      try {
        const matches = body.cachet_file_base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const contentType = matches[1];
          const base64Data = matches[2];
          const buffer = Buffer.from(base64Data, "base64");
          const ext = contentType.split("/")[1] || "png";
          const filePath = `${orgId}/cachet_${Date.now()}.${ext}`;

          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from("branding")
            .upload(filePath, buffer, {
              contentType,
              upsert: true,
            });

          if (!uploadErr && uploadData) {
            const { data: pubData } = supabase.storage.from("branding").getPublicUrl(filePath);
            cachetUrl = pubData.publicUrl;
          } else {
            console.warn("Supabase storage upload failed, keeping base64 fallback:", uploadErr);
            cachetUrl = body.cachet_file_base64;
          }
        } else {
          cachetUrl = body.cachet_file_base64;
        }
      } catch (uploadEx) {
        console.error("Error processing cachet upload:", uploadEx);
        cachetUrl = body.cachet_file_base64;
      }
    }

    // 2. Prepare branding JSON (resilient storage in capital_social)
    const validPolicies = ["shared", "personal", "depot"];
    const invoiceVisibilityPolicy = validPolicies.includes(body.invoice_visibility_policy)
      ? body.invoice_visibility_policy
      : "shared";

    const brandingMeta = {
      cachet_url: cachetUrl,
      brand_color: body.brand_color || "#4f46e5",
      slogan: body.slogan || "",
      show_stamp: body.show_stamp !== false,
      show_qr_code: body.show_qr_code !== false,
      invoice_visibility_policy: invoiceVisibilityPolicy,
    };

    const updatePayload: any = {
      nom_entreprise: body.nom_entreprise || session.organization_name || "Notre Entreprise",
      adresse: body.adresse || "",
      telephone: body.telephone || "",
      email: body.email || "",
      site_web: body.site_web || null,
      rc: body.rc || "",
      nif: body.nif || "",
      art_imposition: body.art_impo || body.art_imposition || "",
      notes_pied_facture: body.notes_pied_facture || "Merci pour votre confiance.",
      capital_social: JSON.stringify(brandingMeta),
      invoice_visibility_policy: invoiceVisibilityPolicy,
    };

    // 3. Find if company record exists for this organization
    const { data: existing } = await supabase
      .from("informations_entreprise")
      .select("id")
      .eq("organization_id", orgId)
      .maybeSingle();

    let savedData: any = null;

    if (existing?.id) {
      // Try updating with native columns first
      let { data: updated, error: updateErr } = await supabase
        .from("informations_entreprise")
        .update({
          ...updatePayload,
          cachet_url: cachetUrl,
          brand_color: brandingMeta.brand_color,
          slogan: brandingMeta.slogan,
          show_stamp: brandingMeta.show_stamp,
          show_qr_code: brandingMeta.show_qr_code,
          invoice_visibility_policy: invoiceVisibilityPolicy,
        })
        .eq("id", existing.id)
        .select()
        .single();

      // If native columns don't exist yet, update with standard fields + capital_social JSON
      if (updateErr) {
        const { data: fallbackUpdated, error: fbErr } = await supabase
          .from("informations_entreprise")
          .update(updatePayload)
          .eq("id", existing.id)
          .select()
          .single();

        if (fbErr) throw fbErr;
        savedData = fallbackUpdated;
      } else {
        savedData = updated;
      }
    } else {
      // Insert new record
      const { data: inserted, error: insertErr } = await supabase
        .from("informations_entreprise")
        .insert({
          ...updatePayload,
          organization_id: orgId,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;
      savedData = inserted;
    }

    return NextResponse.json({
      ok: true,
      company: {
        ...savedData,
        ...brandingMeta,
        cachet_url: cachetUrl,
      },
    });
  } catch (err: any) {
    console.error("POST /api/settings/company error:", err);
    return NextResponse.json({ error: err.message || "Erreur lors de la sauvegarde" }, { status: 500 });
  }
}
