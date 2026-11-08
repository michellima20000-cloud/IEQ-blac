import rateLimit from 'express-rate-limit';

/**
 * Rate limit geral da API: 300 requisições por minuto por IP.
 * (Com `trust proxy` ativo cada usuário tem seu próprio limite;
 * o limite maior evita que o uso normal da PWA esbarre na cota ao reabrir o app)
 */
export const globalRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Muitas requisições',
    message: 'Limite de requisições excedido. Tente novamente em 1 minuto.'
  }
});

/**
 * Rate limit rígido para login: 5 tentativas por minuto por IP (prevenção brute force)
 */
export const loginRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Muitas tentativas de login',
    message: 'Muitas tentativas consecutivas de login. Por segurança, aguarde 1 minuto.'
  }
});

