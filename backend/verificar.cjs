const fetch = require('node-fetch');

async function main() {
  // Login como Pastor
  const loginRes = await fetch('http://localhost:3001/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'pastor@ieq.com', senha: 'Pastor@123', slugIgreja: 'ieq-sede' })
  });
  const loginData = await loginRes.json();
  console.log('Login status:', loginRes.status);
  
  if (loginData.accessToken) {
    // Listar usuários
    const usuariosRes = await fetch('http://localhost:3001/api/v1/usuarios', {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + loginData.accessToken }
    });
    const usuariosData = await usuariosRes.json();
    console.log('Status usuarios:', usuariosRes.status);
    console.log('Total de usuarios:', usuariosData.length);
    
    // Exibir todos os e-mails
    console.log('\nLista de usuários:');
    usuariosData.forEach(u => console.log(' -', u.email, '| perfil:', u.perfil));
    
    // Verificar se daniel.lima123@gmail.com existe
    const existe = usuariosData.some(u => u.email === 'daniel.lima123@gmail.com');
    console.log('\nusuario daniel.lima123@gmail.com existe:', existe);
    
    // Se existir, mostrar perfil
    if (existe) {
      const user = usuariosData.find(u => u.email === 'daniel.lima123@gmail.com');
      console.log('Perfil:', user.perfil);
      console.log('Igreja ID:', user.igreja_id);
    }
  }
}

main().catch(e => console.error('Erro:', e.message));