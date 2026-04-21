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

    // Format currency
    const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(n);

    // Format date
    const formatDate = (d: string | null) => {
      if (!d) return '—';
      try {
        return new Date(d).toLocaleDateString('fr-FR');
      } catch {
        return String(d);
      }
    };

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reçu de Paiement #${payment.id}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f5f5f5;
            padding: 20px;
            color: #333;
        }
        .receipt {
            width: 100%;
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            page-break-after: always;
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #4f46e5;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #4f46e5;
            font-size: 28px;
            margin-bottom: 5px;
        }
        .header p {
            color: #666;
            font-size: 12px;
        }
        .receipt-number {
            text-align: right;
            color: #999;
            font-size: 11px;
            margin-bottom: 20px;
        }
        .info-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid #eee;
        }
        .info-block {
            font-size: 13px;
            line-height: 1.8;
        }
        .info-block-title {
            font-weight: bold;
            color: #4f46e5;
            margin-bottom: 8px;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.5px;
        }
        .info-block-content {
            color: #555;
        }
        .details-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            font-size: 13px;
        }
        .details-table thead {
            background: #f8f8f8;
            border-top: 2px solid #4f46e5;
            border-bottom: 2px solid #4f46e5;
        }
        .details-table th {
            padding: 12px;
            text-align: left;
            font-weight: bold;
            color: #333;
            font-size: 12px;
            text-transform: uppercase;
        }
        .details-table td {
            padding: 12px;
            border-bottom: 1px solid #eee;
        }
        .text-right {
            text-align: right;
        }
        .summary {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 30px;
        }
        .summary-table {
            width: 100%;
            max-width: 350px;
            border-collapse: collapse;
            font-size: 13px;
        }
        .summary-table tr td {
            padding: 8px 12px;
            border-bottom: 1px solid #eee;
        }
        .summary-table tr.total {
            background: #f8f8f8;
            border-top: 2px solid #4f46e5;
            border-bottom: 2px solid #4f46e5;
            font-weight: bold;
            font-size: 16px;
        }
        .summary-table tr.total td {
            padding: 12px;
            border: none;
        }
        .footer {
            text-align: center;
            color: #999;
            font-size: 11px;
            border-top: 1px solid #eee;
            padding-top: 20px;
            margin-top: 30px;
        }
        .stamp {
            text-align: center;
            margin-top: 20px;
            font-weight: bold;
            color: #4f46e5;
            font-size: 14px;
            padding: 10px;
            border: 2px solid #4f46e5;
            border-radius: 4px;
            width: fit-content;
            margin-left: auto;
            margin-right: auto;
        }
        @media print {
            body { background: white; padding: 0; }
            .receipt { box-shadow: none; page-break-after: always; }
            .no-print { display: none; }
        }
        .print-btn {
            display: block;
            margin: 20px auto;
            padding: 12px 30px;
            background: #4f46e5;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
        }
        .print-btn:hover {
            background: #4338ca;
        }
    </style>
</head>
<body>
    <button class="print-btn no-print" onclick="window.print()">🖨️ Imprimer</button>
    
    <div class="receipt">
        <div class="header">
            <h1>REÇU DE PAIEMENT</h1>
            <p>GestionPro - Gestion des Loyers</p>
        </div>

        <div class="receipt-number">
            <strong>Reçu #${payment.id.toString().padStart(6, '0')}</strong><br>
            Émis le ${today.toLocaleDateString('fr-FR')}
        </div>

        <div class="info-section">
            <div class="info-block">
                <div class="info-block-title">Propriétaire / Collecteur</div>
                <div class="info-block-content">
                    GestionPro Enterprise 4K<br>
                    Gestion des Loyers<br>
                    <br>
                    📞 Contact disponible sur demande
                </div>
            </div>
            <div class="info-block">
                <div class="info-block-title">Locataire</div>
                <div class="info-block-content">
                    <strong>${contract.locataire_nom_complet}</strong><br>
                    Référence: ${contract.ref_locataire}<br>
                    ${contract.locataire_telephone ? `<br>📱 ${contract.locataire_telephone}` : ''}
                    ${contract.locataire_email ? `<br>📧 ${contract.locataire_email}` : ''}
                </div>
            </div>
        </div>

        <table class="details-table">
            <thead>
                <tr>
                    <th>Description</th>
                    <th class="text-right">Détails</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Bien Loué</strong></td>
                    <td class="text-right">${contract.bien_loue_details}</td>
                </tr>
                <tr>
                    <td><strong>Loyer Mensuel</strong></td>
                    <td class="text-right">${fmt(contract.loyer_mensuel)}</td>
                </tr>
                <tr>
                    <td><strong>Mois / Période</strong></td>
                    <td class="text-right">${payment.nom_de_mois || payment.periode_debut ? `${payment.nom_de_mois || formatDate(payment.periode_debut)} ${payment.qte_mois ? `(${payment.qte_mois} mois)` : ''}` : '—'}</td>
                </tr>
                ${payment.periode_debut ? `<tr>
                    <td><strong>Période Couverte</strong></td>
                    <td class="text-right">${formatDate(payment.periode_debut)} à ${formatDate(payment.periode_fin)}</td>
                </tr>` : ''}
                <tr>
                    <td><strong>Mode de Paiement</strong></td>
                    <td class="text-right">${payment.mode_paiement}</td>
                </tr>
                <tr>
                    <td><strong>Date de Paiement</strong></td>
                    <td class="text-right"><strong>${formatDate(payment.date_paiement)}</strong></td>
                </tr>
                ${payment.description ? `<tr>
                    <td><strong>Observations</strong></td>
                    <td class="text-right">${payment.description}</td>
                </tr>` : ''}
            </tbody>
        </table>

        <div class="summary">
            <table class="summary-table">
                <tr>
                    <td><strong>Montant Payé</strong></td>
                    <td class="text-right"><strong>${fmt(payment.montant)}</strong></td>
                </tr>
                <tr class="total">
                    <td>TOTAL REÇU</td>
                    <td class="text-right">${fmt(payment.montant)}</td>
                </tr>
            </table>
        </div>

        <div class="stamp">
            ✓ PAYÉ
        </div>

        <div class="footer">
            <p><strong>Ce reçu atteste du paiement reçu</strong></p>
            <p>Conservez ce document. Il constitue une preuve du paiement.</p>
            <p style="margin-top: 15px; color: #ccc;">GestionPro © 2026 | Impression: ${today.toLocaleDateString('fr-FR')} à ${today.toLocaleTimeString('fr-FR')}</p>
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
