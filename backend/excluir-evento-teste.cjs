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
  if (!loginData.accessToken) { console.log('Falha no login:', loginRes.status); return; }
  const token = loginData.accessToken;
  console.log('Login OK (PASTOR)');

  // Listar eventos
  const evRes = await fetch(`${BASE}/calendario`, { headers: { Authorization: 'Bearer ' + token } });
  const evData = await evRes.json().catch(() => ({}));
  const eventos = evData.eventos || evData || [];
  console.log('\nEVENTOS ATUAIS | total:', eventos.length);
  eventos.forEach(ev => console.log(' -', ev.id, '|', ev.titulo, '|', ev.dataInicio));

  // Procurar o evento de avivamento (e similares testes)
  const alvo = eventos.filter(ev => {
    const t = (ev.titulo || '').toLowerCase();
    return t.includes('avivamento') || t.includes('teste') || t.includes('test');
  });

  if (!alvo.length) {
    console.log('\nNenhum evento "avivamento/teste" encontrado no banco. Acontece que a vitrine pode estar vendo CACHE do navegador.');
    return;
  }

  for (const ev of alvo) {
    const r = await fetch(`${BASE}/calendario/${ev.id}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + token }
    });
    const d = await r.json().catch(() => ({}));
    console.log(`DELETE evento ${ev.id} (${ev.titulo}) -> ${r.status} | ${d.message || JSON.stringify(d)}`);
  }

  // Confirmar
  const evRes2 = await fetch(`${BASE}/calendario`, { headers: { Authorization: 'Bearer ' + token } });
  const evData2 = await evRes2.json().catch(() => ({}));
  const eventos2 = evData2.eventos || evData2 || [];
  console.log('\nEVENTOS APOS REMOCAO | total:', eventos2.length);
  eventos2.forEach(ev => console.log(' -', ev.titulo));
}

main().catch(e => console.error('Erro:', e.message));
