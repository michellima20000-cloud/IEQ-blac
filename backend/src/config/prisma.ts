let prismaInstance: any;

try {
  const { PrismaClient } = await import('@prisma/client');
  prismaInstance = new PrismaClient();
} catch {
  // Mock gracioso para testes unitários locais antes do primeiro npm install / docker compose
  prismaInstance = new Proxy({}, {
    get: (_target, prop) => {
      if (prop === '$disconnect' || prop === '$connect') {
        return async () => {};
      }
      return new Proxy({}, {
        get: (_subTarget, _method) => {
          return async () => null;
        }
      });
    }
  });
}

export const prisma = prismaInstance;
