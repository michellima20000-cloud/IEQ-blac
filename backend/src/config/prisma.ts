import type { PrismaClient as PrismaClientType } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClientType };

async function criarPrisma() {
  try {
    const { PrismaClient } = await import('@prisma/client');
    return new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    }) as any;
  } catch {
    // Mock gracioso para ambientes sem client gerado/instalado
    return new Proxy({}, {
      get: (_target, prop) => {
        if (prop === '$disconnect' || prop === '$connect') return async () => {};
        return new Proxy({}, {
          get: () => async () => null
        });
      }
    }) as any;
  }
}

export const prisma: PrismaClientType = globalForPrisma.__prisma ?? (await criarPrisma());
if (!globalForPrisma.__prisma) globalForPrisma.__prisma = prisma as any;
