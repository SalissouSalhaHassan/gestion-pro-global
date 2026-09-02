const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mxairvfgklibhamkpeqq.supabase.co';
const SERVICE_KEY = 'sb_secret_Bj4CF6U_1aAwYu3DlLQuNg_XWQwE_N0';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log("Simulating fixed cash balance route logic...");

  const start = '2026-09-02';
  const end = '2026-09-02';

  // 1. Paiements
  let pQuery = supabase
    .from("paiements")
    .select("id, date_operation, montant_regle, moyen_reglement, reference_paiement, factures(id, bl_number, total_ttc, montant_paye, montant_restant, statut, vendeur)")
    .neq("moyen_reglement", "Crédit");

  if (start) pQuery = pQuery.gte("date_operation", start);
  if (end) pQuery = pQuery.lte("date_operation", `${end}T23:59:59.999Z`);
  const { data: pData, error: pErr } = await pQuery;

  // 2. Avances
  let aQuery = supabase
    .from("avances_clients")
    .select("id, date_avance, reference_paiement, client_id, montant_initial, utilisateur, moyen_paiement, statut")
    .neq("statut", "Annulée");

  if (start) aQuery = aQuery.gte("date_avance", start);
  if (end) aQuery = aQuery.lte("date_avance", `${end}T23:59:59.999Z`);
  const { data: aData, error: aErr } = await aQuery;

  // 3. Factures
  let fQuery = supabase
    .from("factures")
    .select("id, date_facture, bl_number, total_ttc, montant_paye, montant_restant, vendeur, statut, clients(nom)")
    .neq("statut", "Annulée")
    .eq("is_deleted", false);

  if (start) fQuery = fQuery.gte("date_facture", start);
  if (end) fQuery = fQuery.lte("date_facture", `${end}T23:59:59.999Z`);
  const { data: fData, error: fErr } = await fQuery;

  console.log(`Loaded: ${pData?.length || 0} paiements, ${aData?.length || 0} avances, ${fData?.length || 0} factures`);

  const entries = [];

  pData?.forEach(p => {
    const fact = Array.isArray(p.factures) ? p.factures[0] : p.factures;
    entries.push({
      date: p.date_operation,
      ref: fact?.bl_number || p.reference_paiement || `REG-${p.id}`,
      type: fact ? `Vente (${p.moyen_reglement || 'Caisse'})` : "Paiement",
      moyen: p.moyen_reglement || "Cash",
      entree: p.montant_regle > 0 ? p.montant_regle : 0,
      sortie: p.montant_regle < 0 ? Math.abs(p.montant_regle) : 0,
      user: fact?.vendeur || "Caisse",
      emplacement: "BOUTIQUE",
    });
  });

  aData?.forEach(a => {
    entries.push({
      date: a.date_avance,
      ref: a.reference_paiement || `AV-${a.id}`,
      type: "Dépôt (Avance Client)",
      moyen: a.moyen_paiement || "Cash",
      entree: Number(a.montant_initial || 0),
      sortie: 0,
      user: a.utilisateur || "Caisse",
      emplacement: "BOUTIQUE",
    });
  });

  const totalInvoiced = (fData || []).reduce((sum, f) => sum + Number(f.total_ttc || 0), 0);
  const totalAdvances = (aData || []).reduce((sum, a) => sum + Number(a.montant_initial || 0), 0);
  const totalIncome = entries.reduce((sum, e) => sum + e.entree, 0);

  console.log({
    totalInvoiced,
    totalAdvances,
    totalIncome,
    entriesCount: entries.length,
    sampleEntries: entries,
  });
}

main();
