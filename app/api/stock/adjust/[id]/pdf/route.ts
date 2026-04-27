import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const mvtId = parseInt(id, 10);
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'A4';

    if (isNaN(mvtId)) {
      return NextResponse.json({ error: 'Invalid adjustment ID' }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch movement details with article info
    const { data: mvt, error: mError } = await supabase
      .from('mouvements')
      .select(`
        *,
        articles(*)
      `)
      .eq('id', mvtId)
      .single();

    if (mError || !mvt) {
      return NextResponse.json({ error: 'Adjustment not found' }, { status: 404 });
    }

    // Fetch Company Info
    const { data: company } = await supabase.from('informations_entreprise').select('*').limit(1).single();

    const formatDate = (value: string | null | undefined) => {
      if (!value) return '—';
      try {
        return new Date(value).toLocaleDateString('fr-FR', {
           year: 'numeric', month: 'long', day: 'numeric',
           hour: '2-digit', minute: '2-digit'
        });
      } catch {
        return String(value);
      }
    };

    const isA5 = format.toUpperCase() === 'A5';

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bon d'Ajustement #${mvt.nr_doc}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif;
            background: #f1f5f9;
            padding: ${isA5 ? '0' : '40px 20px'};
            color: #0f172a;
            line-height: 1.4;
        }
        .receipt {
            width: 100%;
            max-width: ${isA5 ? '148mm' : '210mm'};
            min-height: ${isA5 ? '100vh' : 'auto'};
            margin: 0 auto;
            background: white;
            padding: ${isA5 ? '15mm' : '40px'};
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
            border-radius: ${isA5 ? '0' : '10px'};
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }
        .header {
            display: flex;
            justify-content: space-between;
            margin-bottom: ${isA5 ? '15px' : '30px'};
            border-bottom: 2px solid #0f172a;
            padding-bottom: ${isA5 ? '10px' : '20px'};
        }
        .company-info h1 {
            font-size: ${isA5 ? '18px' : '24px'};
            font-weight: 900;
            text-transform: uppercase;
        }
        .company-info p {
            font-size: ${isA5 ? '9px' : '12px'};
            color: #64748b;
        }
        .doc-info { text-align: right; }
        .doc-type {
            background: #0f172a;
            color: white;
            padding: 5px 12px;
            font-weight: 900;
            font-size: ${isA5 ? '10px' : '14px'};
            display: inline-block;
            margin-bottom: 5px;
        }
        .doc-ref { font-weight: 900; font-size: ${isA5 ? '12px' : '16px'}; color: #4f46e5; }

        .details-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: ${isA5 ? '15px' : '30px'};
            margin-bottom: ${isA5 ? '20px' : '40px'};
            font-size: ${isA5 ? '10px' : '13px'};
        }
        .section-title {
            font-weight: 900;
            text-transform: uppercase;
            font-size: ${isA5 ? '9px' : '11px'};
            color: #94a3b8;
            border-bottom: 1px solid #e2e8f0;
            margin-bottom: 8px;
            padding-bottom: 4px;
        }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
        .info-label { font-weight: 700; color: #64748b; }
        .info-value { font-weight: 900; }

        .article-card {
            background: #f8fafc;
            border: 2px solid #e2e8f0;
            padding: ${isA5 ? '12px' : '20px'};
            border-radius: ${isA5 ? '10px' : '15px'};
            margin-bottom: ${isA5 ? '20px' : '40px'};
        }
        .article-name { font-size: ${isA5 ? '14px' : '20px'}; font-weight: 900; color: #0f172a; margin-bottom: 4px; }
        .article-ref { font-size: ${isA5 ? '9px' : '11px'}; font-weight: 700; color: #94a3b8; text-transform: uppercase; }

        .adjustment-box {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: ${isA5 ? '8px' : '15px'};
            margin-top: ${isA5 ? '10px' : '20px'};
        }
        .adj-item {
            text-align: center;
            padding: ${isA5 ? '10px' : '15px'};
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
        }
        .adj-label { font-size: ${isA5 ? '8px' : '9px'}; font-weight: 900; text-transform: uppercase; color: #64748b; margin-bottom: 3px; }
        .adj-value { font-size: ${isA5 ? '14px' : '18px'}; font-weight: 900; }
        .adj-value.highlight { color: #4f46e5; }
        .adj-value.pos { color: #10b981; }
        .adj-value.neg { color: #ef4444; }

        .signature-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: ${isA5 ? '30px' : '50px'};
            margin-top: ${isA5 ? '30px' : '60px'};
            text-align: center;
        }
        .sig-box { border-top: 1px solid #0f172a; padding-top: 8px; }
        .sig-label { font-size: ${isA5 ? '9px' : '10px'}; font-weight: 900; text-transform: uppercase; }

        .footer {
            margin-top: ${isA5 ? '20px' : '50px'};
            padding-top: 15px;
            border-top: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            font-size: ${isA5 ? '8px' : '9px'};
            color: #94a3b8;
            font-weight: 700;
        }
        .print-btn {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4f46e5;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 12px;
            font-weight: 700;
            cursor: pointer;
            z-index: 100;
        }
        @media print {
            body { background: white; padding: 0; }
            .receipt { 
                box-shadow: none; border: none; padding: 10mm; 
                width: 148mm; height: 210mm; 
                max-width: none; min-height: none;
            }
            .print-btn { display: none; }
            @page {
                size: A5 portrait;
                margin: 0;
            }
        }
    </style>
</head>
<body>
    <button class="print-btn" onclick="window.print()">Imprimer (Format ${format.toUpperCase()})</button>

    <div class="receipt">
        <div class="header">
            <div class="company-info">
                <h1>${company?.nom_entreprise || "GESTION PRO"}</h1>
                <p>${company?.adresse || ""}</p>
                <p>Tél: ${company?.telephone || ""} | NIF: ${company?.nif || ""}</p>
            </div>
            <div class="doc-info">
                <div class="doc-type">BON D'AJUSTEMENT</div>
                <div class="doc-ref"># ${mvt.nr_doc}</div>
                <p style="font-size: 10px; color: #64748b; margin-top: 5px;">Date: ${formatDate(mvt.date_mouvement)}</p>
            </div>
        </div>

        <div class="details-grid">
            <div>
                <div class="section-title">Informations Générales</div>
                <div class="info-row">
                    <span class="info-label">Opérateur:</span>
                    <span class="info-value">${mvt.utilisateur || 'Admin'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Dépôt:</span>
                    <span class="info-value">${mvt.depot}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Fournisseur:</span>
                    <span class="info-value">${mvt.fournisseur_client || '—'}</span>
                </div>
            </div>
            <div>
                <div class="section-title">Motif / Notes</div>
                <p style="font-size: 12px; font-weight: 500; color: #475569;">${mvt.notes || 'Régularisation manuelle de stock.'}</p>
            </div>
        </div>

        <div class="article-card">
            <div class="article-name">${mvt.articles?.designation}</div>
            <div class="article-ref">REF: ${mvt.articles?.reference} | UNITE: ${mvt.articles?.unite}</div>
            
            <div class="adjustment-box">
                <div class="adj-item">
                    <div class="adj-label">Stock Avant</div>
                    <div class="adj-value">${mvt.stock_avant}</div>
                </div>
                <div class="adj-item">
                    <div class="adj-label">Ajustement</div>
                    <div class="adj-value highlight ${mvt.quantite > 0 ? 'pos' : 'neg'}">
                        ${mvt.quantite > 0 ? '+' : ''}${mvt.quantite}
                    </div>
                </div>
                <div class="adj-item">
                    <div class="adj-label">Nouveau Stock</div>
                    <div class="adj-value">${mvt.stock_apres}</div>
                </div>
            </div>
        </div>

        <div class="signature-section">
            <div class="sig-box">
                <div class="sig-label">Signature de l'Opérateur</div>
            </div>
            <div class="sig-box">
                <div class="sig-label">Visa de la Direction</div>
            </div>
        </div>

        <div class="footer">
            <span>LOGICIEL EASY • Système de Gestion Pro</span>
            <span>Date d'impression: ${new Date().toLocaleString('fr-FR')}</span>
            <span>Document Interne</span>
        </div>
    </div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="ajustement_${mvt.nr_doc}.html"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
