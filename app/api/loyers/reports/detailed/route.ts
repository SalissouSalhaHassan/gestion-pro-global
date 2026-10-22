import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth_helper';
import { ContractService } from '@/lib/services/loyer.service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());
    const statusFilter = searchParams.get('status') || 'All'; // All, Paid, Unpaid

    const supabase = await createClient();
    const session = await getServerSession();
    const orgId = session?.organization_id;
    const service = new ContractService(supabase);
    
    // Fetch all contracts and payments strictly scoped to organization
    let contractQuery = supabase
      .from('contrats')
      .select('*')
      .eq('is_deleted', false);

    if (orgId) {
      contractQuery = contractQuery.eq('organization_id', orgId);
    }

    const { data: contracts, error: contractError } = await contractQuery;

    if (contractError) throw contractError;

    let payQuery = supabase
      .from('contrat_paiements')
      .select('contrat_id, montant, date_paiement, contrats!inner(organization_id)');

    if (orgId) {
      payQuery = payQuery.eq('contrats.organization_id', orgId);
    }

    const { data: payments, error: payError } = await payQuery;

    if (payError) throw payError;

    // Process data
    const reports = contracts.map(c => {
      const startYear = c.annee_debut || 2024;
      const startMonth = c.mois_debut || 1;
      
      // Calculate months elapsed from start until the selected year/month
      const totalMonthsElapsed = (year - startYear) * 12 + (month - startMonth + 1);
      const monthsToCalculate = Math.max(0, totalMonthsElapsed);
      
      const expectedAmount = monthsToCalculate * (c.loyer_mensuel || 0);
      
      // Calculate total paid across all time to determine if rent obligations up to the selected month are met
      const totalPaid = payments
        .filter(p => p.contrat_id === c.id)
        .reduce((sum, p) => sum + (p.montant || 0), 0);

      const retards = Math.max(0, expectedAmount - totalPaid);
      const unpaidMonthsCount = Math.floor(retards / (c.loyer_mensuel || 1));
      
      let moisImpayesText = "À jour";
      if (unpaidMonthsCount > 0) {
        const unpaidYears: Record<number, number> = {};
        let currentYearIter = startYear;
        let currentMonthIter = startMonth;
        let monthsToSkip = Math.floor(totalPaid / (c.loyer_mensuel || 1));
        let remainingToCount = unpaidMonthsCount;

        while (remainingToCount > 0) {
          if (monthsToSkip > 0) {
            monthsToSkip--;
          } else {
            unpaidYears[currentYearIter] = (unpaidYears[currentYearIter] || 0) + 1;
            remainingToCount--;
          }
          currentMonthIter++;
          if (currentMonthIter > 12) {
            currentMonthIter = 1;
            currentYearIter++;
          }
          if (currentYearIter > year + 5) break;
        }
        
        moisImpayesText = Object.entries(unpaidYears)
          .sort((a, b) => Number(a[0]) - Number(b[0]))
          .map(([y, count]) => `${y}: ${count}m`)
          .join(", ");
      }
      
      const monthsPaid = Math.floor(totalPaid / (c.loyer_mensuel || 1));
      const echeanceDate = new Date(startYear, startMonth - 1 + monthsPaid, 1);
      const echeance = echeanceDate.toLocaleDateString('fr-FR');
      const annee = echeanceDate.getFullYear().toString();
      
      let paymentStatus = 'Payé';
      if (retards > 0) paymentStatus = 'Impayé';

      return {
        id: c.id,
        locataire: c.locataire_nom_complet,
        ref: c.ref_locataire,
        loyer: c.loyer_mensuel,
        total_paye: totalPaid,
        retards: retards,
        mois_impayes: moisImpayesText,
        statut_paiement: paymentStatus,
        etat: paymentStatus,
        annee: annee,
        echeance: echeance,
        statut_contrat: c.statut
      };
    });

    // Apply status filter
    let filteredReports = reports;
    if (statusFilter === 'Paid') {
      filteredReports = reports.filter(r => r.retards <= 0);
    } else if (statusFilter === 'Unpaid') {
      filteredReports = reports.filter(r => r.retards > 0);
    }

    return NextResponse.json(filteredReports);

  } catch (error: any) {
    console.error('Detailed Report API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
