const fetch = require('node-fetch');

const BASE = 'https://ieq-black.onrender.com/api/v1';

async function tentarLogin(email, senha) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha, slugIgreja: 'ieq-sede' })
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  const candidatos = [
    ['pastor@ieq.com', 'Pastor@123'],
    ['pastor@ieq.org.br', 'Pastor@123'],
    ['daniel.lima123@gmail.com', 'Pastor@123'],
    ['midia@ieq.com', 'Pastor@123'],
    ['midia@ieq.com', 'Midia@123'],
  ];

  let token = null;
  for (const [email, senha] of candidatos) {
    const r = await tentarLogin(email, senha);
    console.log(`login ${email} / ${senha} -> status ${r.status}`);
    if (r.status === 200 && r.data.accessToken) {
      token = r.data.accessToken;
      console.log('LOGADO COM:', email, '| perfil:', r.data.usuario && r.data.usuario.perfil);
      break;
    }
  }

  if (!token) {
    console.log('Nao consegui logar com nenhum candidato. Informe email/senha validos.');
    return;
  }

  // Buscar vitrine (cache pode ter dado antigo)
  const vRes = await fetch(`${BASE}/midia/vitrine`, { headers: { Authorization: 'Bearer ' + token } });
  const vData = await vRes.json().catch(() => ({}));
  console.log('\nVITRINE status:', vRes.status, '| X-Cache:', vRes.headers.get('x-cache'));
  console.log('Total publicacoes:', vData.total);
  (vData.publicacoes || []).forEach(p => {
    console.log(' -', p.id, '|', p.titulo, '|', p.tipo, '|', p.status, '| autor:', p.autor && p.autor.nome);
  });

  // Buscar minhas midias
  const mRes = await fetch(`${BASE}/midia/minhas`, { headers: { Authorization: 'Bearer ' + token } });
  const mData = await mRes.json().catch(() => ({}));
  console.log('\nMINHAS MIDIAS status:', mRes.status, '| total:', mData.total);
  (mData.conteudos || []).forEach(c => {
    console.log(' -', c.id, '|', c.titulo, '|', c.tipo, '|', c.status);
  });
}

main().catch(e => console.error('Erro:', e.message));
