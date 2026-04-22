import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const paymentId = parseInt(id, 10);

    if (isNaN(paymentId)) {
      return NextResponse.json({ error: 'Invalid payment ID' }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch payment details with contract info
    const { data: payment, error: payError } = await supabase
      .from('contrat_paiements')
      .select(`
        id,
        date_paiement,
        montant,
        mode_paiement,
        nom_de_mois,
        qte_mois,
        periode_debut,
        periode_fin,
        description,
        contrat_id,
        contrats!inner (
          id,
          locataire_nom_complet,
          ref_locataire,
          bien_loue_details,
          loyer_mensuel,
          adresse_complete,
          locataire_telephone,
          locataire_email
        )
      `)
      .eq('id', paymentId)
      .single();

    if (payError || !payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    const contract = (payment as any).contrats;
    const paymentDate = new Date(payment.date_paiement);
    const today = new Date();

    const formatDate = (value: string | null | undefined) => {
      if (!value) return '—';
      try {
        return new Date(value).toLocaleDateString('fr-FR');
      } catch {
        return String(value);
      }
    };

    // Fetch Company Info
    const { data: company } = await supabase.from('informations_entreprise').select('*').limit(1).single();

    const numberToWordsFr = (total: number) => {
      if (total === 0) return "zéro";
      const ones = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
      const teens = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
      const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];
      const convert = (n: number): string => {
        if (n < 10) return ones[n];
        if (n < 20) return teens[n - 10];
        if (n < 70) {
          const t = Math.floor(n / 10);
          const r = n % 10;
          return tens[t] + (r === 1 ? ' et ' : (r > 0 ? '-' : '')) + ones[r];
        }
        if (n < 80) return "soixante-" + convert(n - 60);
        if (n < 100) {
          const t = Math.floor(n / 10);
          const r = n % 10;
          return (t === 8 ? "quatre-vingt" : "quatre-vingt-") + (r > 0 ? (t === 8 ? "-" : "") + convert(r) : "");
        }
        if (n < 1000) {
          const c = Math.floor(n / 100);
          const r = n % 100;
          return (c === 1 ? "cent" : ones[c] + " cent") + (r > 0 ? " " + convert(r) : "");
        }
        const m = Math.floor(n / 1000);
        const r = n % 1000;
        return (m === 1 ? "mille" : convert(m) + " mille") + (r > 0 ? " " + convert(r) : "");
      };
      return convert(Math.floor(total)).charAt(0).toUpperCase() + convert(Math.floor(total)).slice(1);
    };

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reçu de Paiement #${payment.id}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: #f1f5f9;
            padding: 40px 20px;
            color: #0f172a;
            line-height: 1.4;
        }
        .receipt {
            width: 100%;
            max-width: 210mm;
            margin: 0 auto;
            background: white;
            padding: 50px;
            border-radius: 0;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
            position: relative;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 25px;
        }
        .company-info h1 {
            font-size: 28px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: -1px;
            color: #0f172a;
        }
        .company-info p {
            font-size: 13px;
            font-weight: 700;
            color: #475569;
            text-transform: uppercase;
            margin-top: 4px;
        }
        .company-details {
            font-size: 11px;
            font-weight: 600;
            color: #64748b;
            margin-top: 6px;
            display: flex;
            gap: 15px;
        }
        .divider {
            height: 2px;
            background: #0f172a;
            width: 100%;
            margin-bottom: 25px;
        }
        .title-box {
            border: 2px solid #0f172a;
            background: #f8fafc;
            padding: 12px;
            text-align: center;
            margin-bottom: 35px;
        }
        .title-box h2 {
            font-size: 18px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.3em;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 50px;
            margin-bottom: 40px;
        }
        .info-block h3 {
            font-size: 13px;
            font-weight: 900;
            text-transform: uppercase;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 5px;
            margin-bottom: 12px;
        }
        .info-row {
            display: grid;
            grid-template-columns: 100px 1fr;
            font-size: 12px;
            margin-bottom: 6px;
        }
        .info-label {
            font-weight: 900;
            color: #64748b;
            text-transform: uppercase;
        }
        .info-value {
            font-weight: 700;
            color: #0f172a;
        }
        .tenant-name {
            font-size: 15px;
            font-weight: 900;
            color: #0f172a;
            margin-bottom: 4px;
        }
        .tenant-detail {
            font-size: 12px;
            font-weight: 700;
            color: #475569;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }
        th {
            background: #f1f5f9;
            border: 2px solid #0f172a;
            padding: 12px;
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
            text-align: left;
        }
        td {
            border-left: 2px solid #0f172a;
            border-right: 2px solid #0f172a;
            border-bottom: 2px solid #0f172a;
            padding: 15px;
            font-size: 12px;
            vertical-align: top;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .item-desc { font-weight: 900; margin-bottom: 4px; text-transform: uppercase; }
        .item-period { font-weight: 700; color: #475569; font-style: italic; }
        .amount-words {
            font-size: 11px;
            font-style: italic;
            font-weight: 700;
            color: #475569;
            margin-bottom: 35px;
        }
        .amount-words span {
            font-weight: 900;
            color: #0f172a;
            text-transform: uppercase;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            border: 2px solid #0f172a;
            margin-bottom: 40px;
        }
        .summary-box {
            padding: 12px;
            text-align: center;
            border-right: 2px solid #0f172a;
        }
        .summary-box:last-child { border-right: none; }
        .summary-box.gray { background: #f8fafc; }
        .summary-label {
            font-size: 9px;
            font-weight: 900;
            color: #64748b;
            text-transform: uppercase;
            margin-bottom: 4px;
        }
        .summary-value {
            font-size: 18px;
            font-weight: 900;
        }
        .signature-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 80px;
            margin-top: 50px;
            margin-bottom: 60px;
        }
        .signature-box {
            text-align: center;
        }
        .signature-line {
            border-top: 2px solid #0f172a;
            padding-top: 8px;
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
        }
        .signature-sub {
            font-size: 10px;
            font-weight: 700;
            color: #94a3b8;
            font-style: italic;
            margin-top: 4px;
        }
        .footer {
            border-top: 1px solid #e2e8f0;
            padding-top: 15px;
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            font-weight: 700;
            color: #94a3b8;
        }
        .print-btn {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #0f172a;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            font-weight: 700;
            cursor: pointer;
            z-index: 100;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        @media print {
            body { background: white; padding: 0; }
            .receipt { box-shadow: none; max-width: 100%; padding: 10mm; }
            .print-btn { display: none; }
        }
    </style>
</head>
<body>
    <button class="print-btn" onclick="window.print()">IMPRIMER LE REÇU</button>
    
    <div class="receipt">
        <div class="header">
            <div class="company-info">
                <h1>${company?.nom_entreprise || "GESTION PRO"}</h1>
                <p>${company?.adresse || "ADRESSE NON CONFIGURÉE"}</p>
                <div class="company-details">
                    <span>Tél: ${company?.telephone || "—"}</span>
                    <span>NIF: ${company?.nif || "—"}</span>
                    <span>RC: ${company?.rc || "—"}</span>
                </div>
            </div>
        </div>

        <div class="divider"></div>

        <div class="title-box">
            <h2>REÇU DE PAIEMENT</h2>
        </div>

        <div class="info-grid">
            <div class="info-block">
                <h3>Détails du Paiement</h3>
                <div class="info-row">
                    <span class="info-label">Reçu N°:</span>
                    <span class="info-value">${payment.id.toString().padStart(6, '0')}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Date:</span>
                    <span class="info-value">${formatDate(payment.date_paiement)}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Gérant:</span>
                    <span class="info-value">Admin</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Mode:</span>
                    <span class="info-value">${payment.mode_paiement}</span>
                </div>
            </div>
            <div class="info-block">
                <h3>Locataire</h3>
                <div class="tenant-name">${contract.locataire_nom_complet}</div>
                <div class="tenant-detail">Réf: ${contract.ref_locataire}</div>
                ${contract.locataire_telephone ? `<div class="tenant-detail">Tél: ${contract.locataire_telephone}</div>` : ''}
                ${contract.adresse_complete ? `<div class="tenant-detail">${contract.adresse_complete}</div>` : ''}
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Description</th>
                    <th class="text-center" style="width: 80px;">Qté</th>
                    <th class="text-right" style="width: 120px;">Loyer Mens.</th>
                    <th class="text-right" style="width: 120px;">Total</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>
                        <div class="item-desc">LOCATION DU BIEN : ${contract.bien_loue_details}</div>
                        <div class="item-period">Période: ${payment.nom_de_mois || formatDate(payment.periode_debut)}</div>
                        ${payment.description ? `<div style="margin-top: 8px; color: #64748b;">Note: ${payment.description}</div>` : ''}
                    </td>
                    <td class="text-center" style="font-weight: 700;">${payment.qte_mois || 1}</td>
                    <td class="text-right" style="font-weight: 700;">${Number(contract.loyer_mensuel).toLocaleString('fr-FR')}</td>
                    <td class="text-right" style="font-weight: 900;">${Number(payment.montant).toLocaleString('fr-FR')}</td>
                </tr>
            </tbody>
        </table>

        <div class="amount-words">
            Arrêtée la présente somme à : <span>${numberToWordsFr(payment.montant)} francs CFA.</span>
        </div>

        <div class="summary-grid">
            <div class="summary-box gray">
                <div class="summary-label">Total à payer</div>
                <div class="summary-value">${Number(payment.montant).toLocaleString('fr-FR')} F</div>
            </div>
            <div class="summary-box">
                <div class="summary-label">Montant Payé</div>
                <div class="summary-value">${Number(payment.montant).toLocaleString('fr-FR')} F</div>
            </div>
            <div class="summary-box gray">
                <div class="summary-label">Reste à payer</div>
                <div class="summary-value">0 F</div>
            </div>
        </div>

        <div class="signature-grid">
            <div class="signature-box">
                <div class="signature-line">Signature Locataire</div>
                <div class="signature-sub">(Lu et approuvé)</div>
            </div>
            <div class="signature-box">
                <div class="signature-line">Cachet et Signature Bailleur</div>
            </div>
        </div>

        <div class="footer">
            <span>GestionPro - Système de Gestion Immobilière</span>
            <span style="letter-spacing: 2px;">PAGE 1 / 1</span>
        </div>
    </div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="receipt_${payment.id}.html"`,
      },
    });
  } catch (error: any) {
    console.error('Print receipt error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate receipt' },
      { status: 500 }
    );
  }
}
