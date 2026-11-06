import rateLimit from 'express-rate-limit';

/**
 * Rate limit geral da API: 100 requisições por minuto por IP
 */
export const globalRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
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
