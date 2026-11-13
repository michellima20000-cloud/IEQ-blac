import { createRequire } from 'node:module';

const globalForPrisma = globalThis as unknown as { __prisma?: any };

function criarPrisma() {
  if (globalForPrisma.__prisma) return globalForPrisma.__prisma;
  try {
    const require = createRequire(import.meta.url);
    const { PrismaClient } = require('@prisma/client');
    const client = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
    globalForPrisma.__prisma = client;
    return client;
  } catch {
    // Mock gracioso para ambientes sem client gerado/instalado
    return new Proxy({}, {
      get: (_target, prop) => {
        if (prop === '$disconnect' || prop === '$connect') return async () => {};
        return new Proxy({}, {
          get: () => async () => null
        });
      }
    });
  }
}

export const prisma: any = criarPrisma();
