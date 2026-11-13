import type { AuthenticatedRequest } from './auth.ts';
import { prisma } from '../config/prisma.ts';

/**
 * Middleware de isolamento multi-tenant.
 * Garante que a igreja_id esteja sempre injetada na requisição.
 * ADM (dono/superusuário) pode atuar em outra igreja informando x-igreja-id (header) ou igrejaId (query).
 */
export async function tenantMiddleware(req: AuthenticatedRequest, res: any, next: (err?: any) => void): Promise<void> {
  try {
    if (!req.user || !req.user.igreja_id) {
      res.status(401).json({
        error: 'Não autenticado',
        message: 'Identificação da igreja ausente na sessão do usuário.'
      });
      return;
    }

    let alvo = req.user.igreja_id;
    if (req.user.perfil === 'ADM') {
      const override = (req.headers['x-igreja-id'] as string) || (req.query as any)?.igrejaId;
      if (override && typeof override === 'string' && override.trim()) {
        const igreja = await prisma.igreja.findUnique({ where: { id: override.trim() }, select: { id: true } });
        if (!igreja) {
          res.status(404).json({ error: 'NaoEncontrado', message: 'Igreja informada no contexto não encontrada.' });
          return;
        }
        alvo = igreja.id;
      }
    }

    req.igreja_id = alvo;
    if (req.user.perfil === 'ADM' && alvo !== req.user.igreja_id) {
      req.user = { ...req.user, igreja_id: alvo } as any;
    }
    next();
  } catch (err) {
    next(err);
  }
}
