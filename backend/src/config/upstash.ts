import type { Store } from 'express-rate-limit';
import { MemoryStore } from 'express-rate-limit';
import { ENV } from './env.ts';

/**
 * Camada de Redis (Upstash REST) usada para:
 *  - cache em memória externa (vitrine de mídia)
 *  - rate limit distribuído entre instâncias
 * TODA operação é fail-safe: se o Redis estiver fora/inalcançável,
 * retorna null e o chamador segue o fluxo normal (sem cache / memória local).
 */

export function upstashAtivo(): boolean {
  return !!(ENV.UPSTASH_REDIS_REST_URL && ENV.UPSTASH_REDIS_REST_TOKEN);
}

async function pipeline(comandos: (string | number)[][]): Promise<any[] | null> {
  if (!upstashAtivo()) return null;
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), 3000);
  try {
    const res = await fetch(ENV.UPSTASH_REDIS_REST_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ENV.UPSTASH_REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(comandos),
      signal: controle.signal as any
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    const resultados = json.results ?? (json.result !== undefined ? [json.result] : null);
    if (!resultados) return null;
    if (resultados.some((r: any) => r && typeof r === 'object' && 'error' in r)) return null;
    return resultados;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const chavesCache = {
  vitrine: (igreja_id: string) => `ieq:vitrine:${igreja_id}`,
  // Vitrine pública (link compartilhável sem login)
  vitrinePublica: (igreja_id: string) => `ieq:vitrine-publica:${igreja_id}`
};

/**
 * Cache em memória local (fallback quando o Redis está inacessível ou sem
 * permissão de escrita). Em instância única cobre o mesmo papel do Redis.
 */
const memCache = new Map<string, { valor: unknown; expiraEm: number }>();
const MEM_MAX = 50;

function memGet(chave: string): unknown | undefined {
  const item = memCache.get(chave);
  if (!item) return undefined;
  if (Date.now() > item.expiraEm) {
    memCache.delete(chave);
    return undefined;
  }
  return item.valor;
}

function memSet(chave: string, valor: unknown, ttlSegundos: number): void {
  if (memCache.size >= MEM_MAX) {
    // Expira o mais antigo primeiro (simples e suficiente para poucos usuários)
    const maisAntiga = [...memCache.entries()].sort((a, b) => a[1].expiraEm - b[1].expiraEm)[0];
    if (maisAntiga) memCache.delete(maisAntiga[0]);
  }
  memCache.set(chave, { valor, expiraEm: Date.now() + ttlSegundos * 1000 });
}

/**
 * Se a escrita no Redis falha (permissão/fora do ar), desativa as tentativas
 * de escrita por 5 minutos para não adicionar latência a cada requisição.
 */
let redisEscritaOk = true;
let redisEscritaBloqueadaAte = 0;

function escritaRedisAtiva(): boolean {
  if (!upstashAtivo()) return false;
  if (!redisEscritaOk && Date.now() < redisEscritaBloqueadaAte) return false;
  return true;
}

function marcarFalhaEscrita(_chave?: string): void {
  redisEscritaOk = false;
  redisEscritaBloqueadaAte = Date.now() + 5 * 60 * 1000;
}

export async function cacheGet<T>(chave: string): Promise<T | null> {
  const local = memGet(chave);
  if (local !== undefined) return local as T;
  const r = await pipeline([['GET', chave]]);
  if (!r || r[0] === null || r[0] === undefined) return null;
  try {
    return JSON.parse(String(r[0])) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(chave: string, valor: unknown, ttlSegundos: number): Promise<void> {
  memSet(chave, valor, ttlSegundos);
  if (!escritaRedisAtiva()) return;
  const resultado = await pipeline([['SET', chave, JSON.stringify(valor), 'EX', String(ttlSegundos)]]);
  if (resultado === null) {
    redisEscritaOk = false;
    redisEscritaBloqueadaAte = Date.now() + 5 * 60 * 1000;
  }
}

export async function cacheDel(...chaves: string[]): Promise<void> {
  chaves.forEach((c) => memCache.delete(c));
  if (chaves.length === 0) return;
  if (escritaRedisAtiva()) {
    await pipeline(chaves.map((c) => ['DEL', c]));
  }
}

/**
 * Store de rate limit distribuído (fixed window por chave, TTL no primeiro hit).
 * Se o Redis falhar em qualquer operação, cai para o MemoryStore local.
 */
export function upstashRateLimitStore(windowMs: number): Store {
  // express-rate-limit v7: MemoryStore não recebe mais argumentos no construtor
  const memoria = new MemoryStore();
  const ttlSegundos = Math.ceil(windowMs / 1000);

  return {
    increment: async (key: string) => {
      if (!escritaRedisAtiva()) return memoria.increment(key);
      const r = await pipeline([
        ['INCR', `ieq:rl:${key}`],
        ['EXPIRE', `ieq:rl:${key}`, ttlSegundos, 'NX']
      ]);
      if (r === null || r[0] === null) {
        marcarFalhaEscrita();
        return memoria.increment(key);
      }
      return {
        totalHits: Number(r[0]),
        resetTime: new Date(Date.now() + windowMs)
      };
    },
    decrement: async (key: string) => {
      if (!escritaRedisAtiva()) return memoria.decrement(key);
      const r = await pipeline([['DECR', `ieq:rl:${key}`]]);
      if (r === null) {
        marcarFalhaEscrita();
        await memoria.decrement(key);
      }
    },
    resetKey: async (key: string) => {
      if (!escritaRedisAtiva()) return memoria.resetKey(key);
      const r = await pipeline([['DEL', `ieq:rl:${key}`]]);
      if (r === null) {
        marcarFalhaEscrita();
        await memoria.resetKey(key);
      }
    }
  };
}
