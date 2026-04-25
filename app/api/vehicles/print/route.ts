import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'fleet';
    const vehicleId = searchParams.get('vehicleId');
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    const supabase = await createClient();

    let html = `
      <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #334155; }
            .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
            .title { font-size: 24px; font-weight: 800; color: #1e293b; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: #f8fafc; text-align: left; padding: 12px; border: 1px solid #e2e8f0; font-size: 10px; text-transform: uppercase; color: #64748b; }
            td { padding: 12px; border: 1px solid #e2e8f0; font-size: 12px; }
            .footer { margin-top: 40px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; }
            .badge { padding: 4px 8px; rounded: 4px; font-size: 10px; font-weight: bold; }
            .total-row { background: #f1f5f9; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">Rapport de Gestion - Véhicules</div>
              <div style="font-size: 12px; color: #64748b; margin-top: 5px;">Généré le ${new Date().toLocaleDateString('fr-FR')}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: bold; color: #1e293b;">LOGICIEL GESTION PRO</div>
              <div style="font-size: 10px; color: #64748b;">Système de Suivi de Flotte</div>
            </div>
          </div>
    `;

    if (type === 'fleet') {
      const { data: vehicles } = await supabase.from('voitures').select('*').eq('is_deleted', false);
      html += `
        <h3>État de la Flotte Automobile</h3>
        <table>
          <thead>
            <tr>
              <th>Matricule</th>
              <th>Marque / Modèle</th>
              <th>Chauffeur</th>
              <th>Vignette Exp.</th>
              <th>Assurance Exp.</th>
              <th>Prix Achat</th>
            </tr>
          </thead>
          <tbody>
            ${vehicles?.map(v => `
              <tr>
                <td style="font-weight: bold;">${v.matricule}</td>
                <td>${v.marque} ${v.modele}</td>
                <td>${v.chauffeur || '—'}</td>
                <td>${v.date_expiration || '—'}</td>
                <td>${v.date_assurance_exp || '—'}</td>
                <td>${Number(v.prix_achat).toLocaleString()} F</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (type === 'fees' || type === 'expenses') {
      let query = supabase.from('vehicle_records').select('*, voitures(matricule)').eq('record_type', type === 'fees' ? 'FRAI' : 'DEPENSE');
      if (vehicleId && vehicleId !== 'all') query = query.eq('voiture_id', vehicleId);
      if (start) query = query.gte('record_date', start);
      if (end) query = query.lte('record_date', end);

      const { data: records } = await query.order('record_date', { ascending: true });
      const total = records?.reduce((sum, r) => sum + Number(r.amount), 0) || 0;

      html += `
        <h3>Rapport des ${type === 'fees' ? 'Frais de Transport' : 'Dépenses de Maintenance'}</h3>
        <p style="font-size: 12px;">Période: ${start || 'Début'} au ${end || 'Aujourd\'hui'}</p>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Matricule</th>
              <th>Catégorie / Destination</th>
              <th>Notes</th>
              <th style="text-align: right;">Montant</th>
            </tr>
          </thead>
          <tbody>
            ${records?.map(r => `
              <tr>
                <td>${new Date(r.record_date).toLocaleDateString()}</td>
                <td>${r.voitures?.matricule}</td>
                <td>${r.category || r.destination || '—'}</td>
                <td>${r.notes || '—'}</td>
                <td style="text-align: right;">${Number(r.amount).toLocaleString()} F</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="4" style="text-align: right;">TOTAL GÉNÉRAL</td>
              <td style="text-align: right;">${total.toLocaleString()} F</td>
            </tr>
          </tbody>
        </table>
      `;
    }

    html += `
          <div class="footer">
            Document généré automatiquement par le système de gestion - Confidentiel
          </div>
        </body>
      </html>
    `;

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
