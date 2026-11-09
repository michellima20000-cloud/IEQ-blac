const fetch = require('node-fetch');

const BASE = 'https://ieq-black.onrender.com/api/v1';

async function main() {
  // Login como Pastor
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'pastor@ieq.com', senha: 'Pastor@123', slugIgreja: 'ieq-sede' })
  });
  const loginData = await loginRes.json();
  console.log('Login status:', loginRes.status);
  if (!loginData.accessToken) { console.log('Falha no login'); return; }
  const token = loginData.accessToken;

  // IDs dos videos de teste a excluir
  const ids = [
    '7edd6462-6d43-4361-b4b8-f097d29c9162', // Video teste 2MB
    '8889e07c-557b-4769-9e7a-75c7ad29ab2f', // Video 100KB
    '96f57b1a-9629-4089-9b5d-f80be2eee1c7', // Video 1MB
    'c8c21139-eaea-41b5-8182-11950d1532b7'  // Video 10MB
  ];

  for (const id of ids) {
    const r = await fetch(`${BASE}/midia/${id}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + token }
    });
    const d = await r.json().catch(() => ({}));
    console.log(`DELETE ${id} -> status ${r.status} | ${d.message || JSON.stringify(d)}`);
  }

  // Verificar vitrine apos exclusao
  const vRes = await fetch(`${BASE}/midia/vitrine`, { headers: { Authorization: 'Bearer ' + token } });
  const vData = await vRes.json().catch(() => ({}));
  console.log('\nVITRINE APOS EXCLUSAO | X-Cache:', vRes.headers.get('x-cache'), '| Total:', vData.total);
  (vData.publicacoes || []).forEach(p => console.log(' -', p.titulo));
  if (!vData.total) console.log(' (vitrine vazia - todos os videos de teste removidos!)');
}

main().catch(e => console.error('Erro:', e.message));
