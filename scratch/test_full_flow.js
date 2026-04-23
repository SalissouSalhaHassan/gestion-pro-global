
// No need for node-fetch in modern Node
const fetch = globalThis.fetch;

async function testFullFlow() {
  const session = {
    id: 5,
    username: "KADER",
    role: 2,
    admin: "Non",
    emplacement: "BOUTIQUE SIEG",
    depots: ""
  };
  const cookie = `gp_session=${encodeURIComponent(JSON.stringify(session))}`;
  const baseUrl = 'http://localhost:3000';

  console.log('--- STEP 1: CHECKOUT ---');
  const checkoutRes = await fetch(`${baseUrl}/api/pos/checkout`, {
    method: 'POST',
    headers: { 'Cookie': cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: 1,
      depotName: "BOUTIQUE SIEG",
      moyenReglement: "Espece",
      items: [{ id: 68, quantite: 1, prix: 1000 }]
    })
  });

  const checkoutData = await checkoutRes.json();
  console.log('Checkout status:', checkoutRes.status);
  console.log('Checkout response:', JSON.stringify(checkoutData, null, 2));

  if (!checkoutRes.ok) return;

  const invoiceId = checkoutData.invoice_id || (checkoutData.sale && checkoutData.sale.facture_id);
  if (!invoiceId) {
    console.error('No invoice ID in response');
    return;
  }

  console.log('\n--- STEP 2: GET INVOICE ---');
  const invRes = await fetch(`${baseUrl}/api/invoices/${invoiceId}`, {
    headers: { 'Cookie': cookie }
  });
  console.log('Get Invoice status:', invRes.status);
  const invData = await invRes.json();
  console.log('Get Invoice response:', JSON.stringify(invData, null, 2));

  if (!invRes.ok) return;

  console.log('\n--- STEP 3: RECORD PAYMENT ---');
  const payRes = await fetch(`${baseUrl}/api/invoices/${invoiceId}/payments`, {
    method: 'POST',
    headers: { 'Cookie': cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      montant_regle: 100,
      moyen_reglement: "Espece",
      date_operation: new Date().toISOString().split('T')[0]
    })
  });

  const payData = await payRes.json();
  console.log('Payment status:', payRes.status);
  console.log('Payment response:', JSON.stringify(payData, null, 2));
}

testFullFlow();
