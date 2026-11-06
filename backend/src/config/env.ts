// Carrega .env nativamente no Node 20+ ou faz fallback
try {
  if (typeof (process as any).loadEnvFile === 'function') {
    (process as any).loadEnvFile();
  }
} catch {
  // Ignora se arquivo .env não existir
}

export const ENV = {
  PORT: Number(process.env.PORT) || 3001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  JWT_SECRET: process.env.JWT_SECRET || 'ieq_jwt_access_secret_super_seguro_2026',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'ieq_jwt_refresh_secret_super_seguro_2026',
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres_password@localhost:5432/ieq_db?schema=public',
  // Redis via protocolo padrão (ioredis / BullMQ)
  REDIS_URL: process.env.REDIS_URL || 'redis://default:gQAAAAAAAvVLAAIgcDJhMGYwYjVmZDkwZGI0OWY3YmFjZWQwNDNkMjdjNzI0NA@engaged-mudfish-193867.upstash.io:6379',
  // Upstash REST API (rate limit / cache HTTP)
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || 'https://engaged-mudfish-193867.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || ''
};
