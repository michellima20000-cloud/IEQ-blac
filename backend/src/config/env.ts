import { randomBytes } from 'node:crypto';

// Carrega .env nativamente no Node 20+ ou faz fallback
try {
  if (typeof (process as any).loadEnvFile === 'function') {
    (process as any).loadEnvFile();
  }
} catch {
  // Ignora se arquivo .env não existir
}

const ENV_NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Segredo JWT: em produção é obrigatório vir do ambiente (.env / painel Render).
 * Em desenvolvimento, se não vier, geramos um segredo aleatório POR PROCESSO
 * (tokens não sobrevivem a um reinício) — nunca um valor fixo no código,
 * porque um segredo fixo permite forjar token de ADM por qualquer pessoa.
 */
function segredoJwt(nome: string): string {
  const doAmbiente = process.env[nome];
  if (doAmbiente && doAmbiente.trim().length >= 16) return doAmbiente.trim();
  if (ENV_NODE_ENV === 'production') {
    throw new Error(
      `[config] ${nome} é obrigatório em produção (mínimo 16 caracteres). Configure a variável de ambiente.`
    );
  }
  console.warn(`[config] ${nome} não configurada. Gerando segredo aleatório temporário (apenas desenvolvimento).`);
  return randomBytes(48).toString('hex');
}

export const ENV = {
  PORT: Number(process.env.PORT) || 3001,
  NODE_ENV: ENV_NODE_ENV,
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  JWT_SECRET: segredoJwt('JWT_SECRET'),
  JWT_REFRESH_SECRET: segredoJwt('JWT_REFRESH_SECRET'),
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres_password@localhost:5432/ieq_db?schema=public',
  // Redis via protocolo padrão (ioredis / BullMQ). Sem valor = desativado.
  REDIS_URL: process.env.REDIS_URL || '',
  // Upstash REST API (rate limit / cache HTTP)
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || '',
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || '',
  /**
   * Segredo de manutenção: protege /api/v1/setup-db e /api/v1/admin/bootstrap.
   * Sem esse valor as rotas destrutivas ficam desabilitadas.
   */
  SETUP_SECRET: process.env.SETUP_SECRET || '',
  /**
   * Dono do sistema: e-mails autorizados a acessar o painel/rotas de ADM.
   * Lista separada por vírgula. Se definido, SOMENTE estes e-mails (com perfil ADM)
   * podem usar /api/v1/admin e o bootstrap só cria/promove estes e-mails.
   */
  ADMIN_OWNER_EMAILS: (process.env.ADMIN_OWNER_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
};
