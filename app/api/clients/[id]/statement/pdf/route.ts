import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServerSession } from "@/lib/auth_helper";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const clientId = parseInt(rawId, 10);
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("start") || "";
    const endDate = searchParams.get("end") || "";
    const lang = searchParams.get("lang") || "fr";
    const autoPrint = searchParams.get("autoPrint") === "true";

    if (isNaN(clientId)) {
      return NextResponse.json({ error: "Invalid client ID" }, { status: 400 });
    }

    const supabase = await createClient();
    const session = await getServerSession();

    // 1. Fetch Client Details
    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .single();

    if (clientErr || !client) {
      return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
    }

    // 2. Fetch Company Details
    const { data: company } = await supabase
      .from("informations_entreprise")
      .select("*")
      .limit(1)
      .single();

    // 3. Fetch Client Advances
    const { data: advances } = await supabase
      .from("avances_clients")
      .select("*")
      .eq("client_id", clientId);

    // 4. Fetch Client Invoices
    const { data: invoices } = await supabase
      .from("factures")
      .select("*")
      .eq("client_id", clientId)
      .neq("statut", "Annulée");

    // 5. Fetch Client Payments
    const { data: payments } = await supabase
      .from("paiements")
      .select("*, factures!inner(*)")
      .eq("factures.client_id", clientId);

    // 6. Build Raw Ledger Events
    const rawEvents: any[] = [];

    advances?.forEach((adv) => {
      rawEvents.push({
        date: adv.date_avance || adv.created_at,
        type: lang === "ar" ? "إيداع أمانة" : "Dépôt d'Acompte",
        reference: adv.reference_paiement || `DEP-${adv.id}`,
        mode: adv.moyen_paiement || "Espèce",
        debit: 0,
        credit: Number(adv.montant_initial) || 0,
        notes: adv.notes || (lang === "ar" ? "إيداع أمانة نقدية" : "Dépôt d'avance client"),
        user: adv.utilisateur || "Admin",
      });
    });

    invoices?.forEach((inv) => {
      const invPayments = payments?.filter(p => Number(p.facture_id) === Number(inv.id)) || [];
      const advancePaidAmount = invPayments
        .filter(p => p.moyen_reglement === "Avance")
        .reduce((sum, p) => sum + Number(p.montant_regle || 0), 0);
      const hasAdvancePayment = advancePaidAmount > 0;

      let typeLabel = lang === "ar" ? "فاتورة مبيعات" : "Facture Vente";
      let modeLabel = inv.mode_paiement || (lang === "ar" ? "فاتورة" : "Facturation");
      let notesLabel = `${lang === "ar" ? "مبيعات بضاعة" : "Vente marchandises"} ${inv.bl_number ? `(BL: ${inv.bl_number})` : ""}`;

      if (hasAdvancePayment) {
        if (advancePaidAmount >= Number(inv.total_ttc)) {
          typeLabel = lang === "ar" ? "تسوية فاتورة بالأمانة" : "Règlement Facture (par Avance)";
          modeLabel = "Imputation Avance";
          notesLabel = `${lang === "ar" ? "فاتورة مسددة من رصيد الأمانة" : "Facture acquittée par acompte"} ${inv.bl_number ? `(BL: ${inv.bl_number})` : ""}`;
        } else {
          typeLabel = lang === "ar" ? "فاتورة / تسوية جزئية بأمانة" : "Facture / Règlement partiel Avance";
          modeLabel = "Mixte / Avance";
          notesLabel = `${lang === "ar" ? `مسدد منها ${advancePaidAmount.toLocaleString()} بالأمانة` : `Réglée à hauteur de ${advancePaidAmount.toLocaleString()} FCFA par acompte`} ${inv.bl_number ? `(BL: ${inv.bl_number})` : ""}`;
        }
      }

      rawEvents.push({
        date: inv.date_facture || inv.created_at,
        type: typeLabel,
        reference: inv.bl_number || inv.num_facture || `FAC-${inv.id}`,
        mode: modeLabel,
        debit: Number(inv.total_ttc) || 0,
        credit: 0,
        notes: notesLabel,
        user: inv.vendeur || "Admin",
      });
    });

    payments?.forEach((p) => {
      if (p.moyen_reglement !== "Avance") {
        rawEvents.push({
          date: p.date_operation || p.created_at,
          type: lang === "ar" ? "سداد نقدي" : "Règlement Facture",
          reference: p.factures?.bl_number || p.factures?.num_facture || `REG-${p.id}`,
          mode: p.moyen_reglement || "Espèce",
          debit: 0,
          credit: Number(p.montant_regle) || 0,
          notes: `${lang === "ar" ? "سداد عبر" : "Règlement via"} ${p.moyen_reglement || "Espèce"}`,
          user: p.utilisateur || "Admin",
        });
      }
    });

    // Sort Chronologically
    rawEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 7. Calculate Opening Balance and Period Events
    let openingBalance = 0;
    const periodEvents: any[] = [];
    const startObj = startDate ? new Date(startDate + "T00:00:00") : null;
    const endObj = endDate ? new Date(endDate + "T23:59:59.999") : null;

    rawEvents.forEach((e) => {
      const eDate = new Date(e.date);
      if (startObj && eDate < startObj) {
        openingBalance += (e.credit - e.debit);
      } else if (!endObj || eDate <= endObj) {
        periodEvents.push(e);
      }
    });

    let runningBalance = openingBalance;
    let totalDebit = 0;
    let totalCredit = 0;

    const formattedRows = periodEvents.map((e) => {
      totalDebit += e.debit;
      totalCredit += e.credit;
      runningBalance += (e.credit - e.debit);
      return {
        ...e,
        solde_courant: runningBalance,
      };
    });

    const isAr = lang === "ar";
    const dir = isAr ? "rtl" : "ltr";
    const closingBalance = runningBalance;

    const formatFCFA = (val: number) => {
      return new Intl.NumberFormat("fr-FR").format(Math.round(val)) + " FCFA";
    };

    const formatDateStr = (val: string) => {
      try {
        const d = new Date(val);
        return d.toLocaleDateString(isAr ? "ar-SA" : "fr-FR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });
      } catch {
        return val;
      }
    };

    const html = `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Relevé_Compte_${(client.nom || "Client").replace(/\\s+/g, "_")}_${new Date().toISOString().split("T")[0]}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&family=Inter:wght@400;500;600;700;900&display=swap');
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: ${isAr ? "'Cairo', sans-serif" : "'Inter', -apple-system, sans-serif"};
            background: #e2e8f0;
            color: #0f172a;
            padding: 30px 15px;
            font-size: 11px;
            line-height: 1.4;
        }

        .action-bar {
            max-width: 210mm;
            margin: 0 auto 20px auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .btn-print {
            background: #2563eb;
            color: white;
            border: none;
            padding: 10px 22px;
            border-radius: 12px;
            font-weight: 900;
            font-size: 13px;
            cursor: pointer;
            box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3);
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }

        .btn-print:hover { background: #1d4ed8; }

        .btn-close {
            background: white;
            color: #475569;
            border: 1px solid #cbd5e1;
            padding: 10px 18px;
            border-radius: 12px;
            font-weight: 700;
            cursor: pointer;
        }

        .page-container {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            background: white;
            padding: 18mm 15mm;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
            border-radius: 6px;
            position: relative;
        }

        .header-section {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 12px;
            margin-bottom: 16px;
        }

        .company-title {
            font-size: 18px;
            font-weight: 900;
            text-transform: uppercase;
            color: #0f172a;
            letter-spacing: -0.5px;
        }

        .company-sub {
            font-size: 10px;
            color: #475569;
            font-weight: 600;
            margin-top: 2px;
        }

        .company-meta {
            font-size: 9px;
            color: #64748b;
            margin-top: 4px;
            font-family: monospace;
        }

        .doc-badge {
            background: #0f172a;
            color: white;
            padding: 5px 14px;
            font-weight: 900;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 1px;
            border-radius: 4px;
            display: inline-block;
            text-align: right;
        }

        .doc-ref {
            font-size: 9px;
            color: #64748b;
            margin-top: 4px;
            font-weight: 700;
            font-family: monospace;
        }

        .client-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 12px 16px;
            display: flex;
            justify-content: space-between;
            margin-bottom: 16px;
        }

        .client-name {
            font-size: 14px;
            font-weight: 900;
            color: #0f172a;
            text-transform: uppercase;
        }

        .kpi-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 18px;
        }

        .kpi-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 8px 10px;
            text-align: center;
        }

        .kpi-label {
            font-size: 8px;
            font-weight: 800;
            text-transform: uppercase;
            color: #64748b;
            letter-spacing: 0.5px;
        }

        .kpi-value {
            font-size: 13px;
            font-weight: 900;
            margin-top: 3px;
        }

        .kpi-value.green { color: #059669; }
        .kpi-value.red { color: #dc2626; }
        .kpi-value.blue { color: #2563eb; }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }

        thead tr {
            background: #0f172a;
            color: white;
            font-size: 9px;
            font-weight: 800;
            text-transform: uppercase;
        }

        thead th {
            padding: 8px 6px;
            border: 1px solid #0f172a;
        }

        tbody td {
            padding: 6px 6px;
            border: 1px solid #cbd5e1;
            font-size: 10px;
        }

        tbody tr:nth-child(even) { background: #f8fafc; }

        .tag {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 8px;
            font-weight: 800;
            text-transform: uppercase;
        }

        .tag-dep { background: #dbeafe; color: #1e40af; }
        .tag-fac { background: #ffe4e6; color: #9f1239; }
        .tag-pay { background: #dcfce7; color: #166534; }

        tfoot tr {
            background: #0f172a;
            color: white;
            font-weight: 900;
            font-size: 10px;
        }

        tfoot td {
            padding: 8px 6px;
            border: 1px solid #0f172a;
        }

        .signatures {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin-top: 25px;
            padding-top: 15px;
            border-top: 1px solid #cbd5e1;
            text-align: center;
        }

        .sig-title {
            font-weight: 900;
            text-transform: uppercase;
            font-size: 9px;
            color: #0f172a;
        }

        .sig-space {
            height: 50px;
            border-bottom: 1px dashed #94a3b8;
            margin-top: 8px;
        }

        .footer-note {
            text-align: center;
            color: #94a3b8;
            font-size: 8px;
            margin-top: 20px;
        }

        @media print {
            body {
                background: white;
                padding: 0;
            }
            .action-bar { display: none !important; }
            .page-container {
                width: 100%;
                min-height: auto;
                box-shadow: none;
                border-radius: 0;
                padding: 5mm;
            }
            @page {
                size: A4 portrait;
                margin: 8mm;
            }
        }
    </style>
</head>
<body>
    <div class="action-bar">
        <button class="btn-print" onclick="window.print()">
            🖨️ ${isAr ? "طباعة / حفظ كـ PDF" : "Imprimer / Enregistrer en PDF"}
        </button>
        <button class="btn-close" onclick="window.close()">
            ✕ ${isAr ? "إغلاق النافذة" : "Fermer"}
        </button>
    </div>

    <div class="page-container">
        <!-- Header -->
        <div class="header-section">
            <div>
                <div class="company-title">${company?.nom_entreprise || "GESTION PRO GLOBAL"}</div>
                <div class="company-sub">${company?.activite || "Solutions Commerciales & ERP Multi-dépôts"}</div>
                <div class="company-meta">
                    ${company?.adresse || "Siège Commercial"} | Tél: ${company?.telephone || "—"} | NIF: ${company?.nif || "—"} | RCCM: ${company?.rccm || "—"}
                </div>
            </div>
            <div style="text-align: ${isAr ? "left" : "right"};">
                <div class="doc-badge">${isAr ? "كشف حساب عميل رسمي" : "RELEVÉ DE COMPTE CLIENT"}</div>
                <div class="doc-ref">REF: REL-${client.id}-${new Date().toISOString().slice(0,10).replace(/-/g,"")}</div>
                <div style="font-size: 8px; color: #64748b; margin-top: 2px;">
                    ${isAr ? "تاريخ الإصدار:" : "Édité le :"} ${new Date().toLocaleString(isAr ? "ar-SA" : "fr-FR")}
                </div>
            </div>
        </div>

        <!-- Client Box -->
        <div class="client-card">
            <div>
                <div style="font-size: 8px; font-weight: 800; color: #64748b; text-transform: uppercase;">
                    ${isAr ? "العميل المستفيد" : "COMPTE CLIENT"}
                </div>
                <div class="client-name">${client.nom}</div>
                <div style="font-size: 9px; color: #475569; font-weight: 700; margin-top: 2px;">
                    REF: ${client.ref_client || "CL-" + client.id} | ${isAr ? "هاتف:" : "Tél:"} ${client.tel || "—"}
                </div>
            </div>
            <div style="text-align: ${isAr ? "left" : "right"};">
                <div style="font-size: 8px; font-weight: 800; color: #64748b; text-transform: uppercase;">
                    ${isAr ? "فترة الكشف المحاسبي" : "PÉRIODE DU RELEVÉ"}
                </div>
                <div style="font-size: 10px; font-weight: 900; color: #1e293b; margin-top: 2px;">
                    ${startDate && endDate 
                      ? `${isAr ? "من" : "Du"} ${formatDateStr(startDate)} ${isAr ? "إلى" : "au"} ${formatDateStr(endDate)}` 
                      : `${isAr ? "كامل السجل التاريخي" : "Historique Global Complet"}`}
                </div>
            </div>
        </div>

        <!-- Summary KPIs -->
        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-label">${isAr ? "رصيد سابق منقول" : "Report à Nouveau"}</div>
                <div class="kpi-value ${openingBalance >= 0 ? "blue" : "red"}">
                    ${formatFCFA(openingBalance)}
                </div>
            </div>

            <div class="kpi-card">
                <div class="kpi-label">${isAr ? "إجمالي المقبوضات (+)" : "Total Crédits (+)"}</div>
                <div class="kpi-value green">+${formatFCFA(totalCredit)}</div>
            </div>

            <div class="kpi-card">
                <div class="kpi-label">${isAr ? "إجمالي المشتريات (-)" : "Total Débits (-)"}</div>
                <div class="kpi-value red">-${formatFCFA(totalDebit)}</div>
            </div>

            <div class="kpi-card" style="border: 2px solid #0f172a;">
                <div class="kpi-label">${isAr ? "الرصيد الختامي الصافي" : "Solde de Clôture"}</div>
                <div class="kpi-value ${closingBalance >= 0 ? "blue" : "red"}">
                    ${closingBalance > 0 ? "+" : ""}${formatFCFA(closingBalance)}
                </div>
            </div>
        </div>

        <!-- Ledger Table -->
        <table>
            <thead>
                <tr>
                    <th style="width: 70px; text-align: center;">${isAr ? "التاريخ" : "Date"}</th>
                    <th style="width: 100px;">${isAr ? "نوع العملية" : "Opération"}</th>
                    <th style="width: 90px;">${isAr ? "المرجع" : "Référence"}</th>
                    <th style="width: 60px; text-align: center;">${isAr ? "طريقة الدفع" : "Mode"}</th>
                    <th style="width: 75px; text-align: right;">${isAr ? "مدين (-)" : "Débit (-)"}</th>
                    <th style="width: 75px; text-align: right;">${isAr ? "دائن (+)" : "Crédit (+)"}</th>
                    <th style="width: 85px; text-align: right;">${isAr ? "الرصيد" : "Solde"}</th>
                    <th>${isAr ? "البيان والتفاصيل" : "Libellé"}</th>
                </tr>
            </thead>
            <tbody>
                ${startDate ? `
                <tr style="background: #f1f5f9; font-weight: bold;">
                    <td style="text-align: center;">${formatDateStr(startDate)}</td>
                    <td><strong>REPORT</strong></td>
                    <td>—</td>
                    <td style="text-align: center;">—</td>
                    <td style="text-align: right;">—</td>
                    <td style="text-align: right;">—</td>
                    <td style="text-align: right; font-weight: 900; color: ${openingBalance >= 0 ? '#1e293b' : '#dc2626'};">${formatFCFA(openingBalance)}</td>
                    <td><em>${isAr ? "رصيد سابق منقول" : "Report du solde antérieur"}</em></td>
                </tr>
                ` : ""}
                ${formattedRows.length === 0 ? `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 25px; color: #94a3b8; font-weight: bold;">
                        ${isAr ? "لا توجد أي حركات مالية مسجلة خلال الفترة." : "Aucune écriture comptable durant la période."}
                    </td>
                </tr>
                ` : formattedRows.map((r) => `
                <tr>
                    <td style="text-align: center; font-family: monospace; font-size: 9px;">${formatDateStr(r.date)}</td>
                    <td>
                        <span class="tag ${r.credit > 0 ? "tag-pay" : "tag-fac"}">${r.type}</span>
                    </td>
                    <td style="font-family: monospace; font-weight: 700;">${r.reference}</td>
                    <td style="text-align: center; font-size: 9px;">${r.mode}</td>
                    <td style="text-align: right; color: #dc2626; font-weight: 700;">${r.debit > 0 ? "-" + formatFCFA(r.debit) : "—"}</td>
                    <td style="text-align: right; color: #059669; font-weight: 700;">${r.credit > 0 ? "+" + formatFCFA(r.credit) : "—"}</td>
                    <td style="text-align: right; font-weight: 900; color: ${r.solde_courant >= 0 ? '#1e40af' : '#dc2626'}; font-family: monospace;">
                        ${r.solde_courant > 0 ? "+" : ""}${formatFCFA(r.solde_courant)}
                    </td>
                    <td style="font-size: 9px; color: #475569;">${r.notes || "—"}</td>
                </tr>
                `).join("")}
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="4" style="text-align: ${isAr ? "left" : "right"}; font-size: 9px;">
                        ${isAr ? "مجاميع الفترة المحاسبية :" : "TOTAUX DE LA PÉRIODE :"}
                    </td>
                    <td style="text-align: right; color: #fca5a5;">-${formatFCFA(totalDebit)}</td>
                    <td style="text-align: right; color: #86efac;">+${formatFCFA(totalCredit)}</td>
                    <td style="text-align: right; font-size: 11px;">${closingBalance > 0 ? "+" : ""}${formatFCFA(closingBalance)}</td>
                    <td style="font-size: 9px; font-weight: normal;">
                        ${closingBalance > 0 
                          ? (isAr ? "دائن لصالح العميل" : "Solde en faveur du client")
                          : closingBalance < 0 
                            ? (isAr ? "مدين مستحق على العميل" : "Créance due par le client")
                            : (isAr ? "حساب متوازن" : "Compte soldé")}
                    </td>
                </tr>
            </tfoot>
        </table>

        <!-- Signatures -->
        <div class="signatures">
            <div>
                <div class="sig-title">${isAr ? "توقيع ومصادقة العميل" : "Le Client (Bon pour accord)"}</div>
                <div class="sig-space"></div>
            </div>
            <div>
                <div class="sig-title">${isAr ? "أمين الصندوق / المحاسب" : "Visa Caissier / Comptable"}</div>
                <div class="sig-space"></div>
            </div>
            <div>
                <div class="sig-title">${isAr ? "خاتم الإدارة والمؤسسة" : "Direction Générale (Cachet)"}</div>
                <div class="sig-space"></div>
            </div>
        </div>

        <div class="footer-note">
            ${isAr 
              ? "وثيقة مالية رسمية صادرة آلياً من نظام GESTION PRO GLOBAL. صالحة للمطابقة المحاسبية والتسوية."
              : "Extrait de compte certifié conforme aux écritures du système GESTION PRO GLOBAL. Document officiel faisant foi pour rapprochement financier."}
        </div>
    </div>

    <script>
        ${autoPrint ? `
        window.addEventListener('load', function() {
            setTimeout(function() {
                window.print();
            }, 500);
        });
        ` : ''}
    </script>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="releve_client_${clientId}.html"`,
      },
    });
  } catch (error: any) {
    console.error("Error generating PDF statement:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
