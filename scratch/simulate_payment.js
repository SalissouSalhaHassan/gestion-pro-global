
const fetch = require('node-fetch');

async function simulatePayment() {
  const invoiceId = 56;
  const session = {
    id: 5,
    username: "KADER",
    role: 2,
    admin: "Non",
    emplacement: "BOUTIQUE SIEG",
    depots: ""
  };
  
  const cookie = `gp_session=${encodeURIComponent(JSON.stringify(session))}`;
  
  console.log('Sending request for invoice', invoiceId, 'as', session.username);
  
  try {
    const res = await fetch(`http://localhost:3000/api/invoices/${invoiceId}/payments`, {
      method: 'POST',
      headers: {
        'Cookie': cookie,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        montant_regle: 100,
        moyen_reglement: "Espece",
        date_operation: new Date().toISOString().split('T')[0]
      })
    });
    
    console.log('Response status:', res.status);
    const text = await res.text();
    console.log('Response text:', text);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

simulatePayment();
