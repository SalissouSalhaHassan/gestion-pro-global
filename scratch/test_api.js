async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'password' })
    });
    console.log('Status:', res.status);
    console.log('Headers:', Object.fromEntries(res.headers.entries()));
    const data = await res.text();
    console.log('Body:', data);
  } catch (e) {
    console.error('Error:', e);
  }
}
test();
