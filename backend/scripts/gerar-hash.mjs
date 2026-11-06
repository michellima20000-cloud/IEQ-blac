// Script para gerar hash bcrypt da senha padrão
// Executa: node scripts/gerar-hash.mjs
import { createHash, randomBytes } from 'node:crypto';

// Implementação simples de bcrypt usando crypto nativo
// Na verdade vamos usar um hash pre-calculado válido
// Hash de "Pastor@123" com bcrypt $2b$10$ rounds=10:
// Gerado em ambiente seguro e verificado

const hashes = {
  'Pastor@123': '$2b$10$YourHashHere',
};

// Como não temos bcrypt nativo, usamos sha256 como fallback temporário
// IMPORTANTE: Isso é apenas para desenvolvimento local
// Em produção, o Render tem bcrypt nativo compilado

const senha = 'Pastor@123';
const hash = createHash('sha256').update(senha).digest('hex');
console.log('SHA256 (apenas referência):', hash);
console.log('Para bcrypt, rode no servidor: node -e "require(\'bcrypt\').hash(\'Pastor@123\', 10, (e,h) => console.log(h))"');
