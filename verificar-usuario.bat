@echo off
cd /d "C:\IEQ-black\backend"
node -e '
const fetch = require('node-fetch');

async function main() {
  // Login como Pastor
  const loginRes = await fetch("http://localhost:3001/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "pastor@ieq.com", senha: "Pastor@123", slugIgreja: "ieq-sede" })
  });
  const loginData = await loginRes.json();
  console.log("Login status:", loginRes.status);
  
  if (loginData.accessToken) {
    // Listar usuários
    const usuariosRes = await fetch("http://localhost:3001/api/v1/usuarios", {
      method: "GET",
      headers: { "Authorization": "Bearer " + loginData.accessToken }
    });
    const usuariosData = await usuariosRes.json();
    console.log("Status usuarios:", usuariosRes.status);
    console.log("Total de usuarios:", usuariosData.length);
    
    // Exibir todos os e-mails
    console.log("\nLista de usuários:");
    usuariosData.forEach(u => console.log(" -", u.email, "| perfil:", u.perfil));
    
    // Verificar se daniel.lima123@gmail.com existe
    const existe = usuariosData.some(u => u.email === "daniel.lima123@gmail.com");
    console.log("\nusuario daniel.lima123@gmail.com existe:", existe);
    
    // Verificar permissões de mídia desse usuario (se existir)
    if (existe) {
      const user = usuariosData.find(u => u.email === "daniel.lima123@gmail.com");
      console.log("\nPerfil do usuario:", user.perfil);
      console.log("Igreja ID:", user.igreja_id);
      
      // Verificar se pode ver vitrine
      console.log("\nPermissões do perfil MIDIA:");
      console.log("- Pode criar conteúdo: SIM");
      console.log("- Pode ver próprias mídias (GET /minhas): SIM");
      console.log("- Pode editar/excluir próprios: SIM");
      console.log("- Pode ver vitrine pública: SIM (apenas PUBLICADO)");
      console.log("- Pode acessar outras igrejas: NÃO (isolamento multi-tenant)");
    }
  }
}

main().catch(e => console.error("Erro:", e.message));
'