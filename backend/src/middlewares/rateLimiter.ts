import rateLimit from 'express-rate-limit';
import { upstashAtivo, upstashRateLimitStore } from '../config/upstash.ts';

/**
 * Rate limit distribuído via Redis (Upstash) quando configurado; cai para
 * memória local se o Redis não responder. Assim o limite "300 por minuto
 * por IP" vale de verdade mesmo com várias instâncias da API.
 */
function criarLimiteGlobal(qtdPorMinuto: number) {
  const opcoes: any = {
    windowMs: 60 * 1000,
    max: qtdPorMinuto,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Muitas requisições',
      message: 'Limite de requisições excedido. Tente novamente em 1 minuto.'
    }
  };
  if (upstashAtivo()) {
    opcoes.store = upstashRateLimitStore(opcoes.windowMs);
  }
  return rateLimit(opcoes);
}

export const globalRateLimiter = criarLimiteGlobal(300);

/**
 * Rate limit rígido para login: 5 tentativas por minuto por IP (prevensão brute force).
 * Fica em memória local de propósito: deve ser rápido e independente de rede.
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

