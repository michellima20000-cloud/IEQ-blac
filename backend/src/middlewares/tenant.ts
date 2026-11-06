import type { AuthenticatedRequest } from './auth.ts';

/**
 * Middleware de isolamento multi-tenant.
 * Garante que a igreja_id do usuário autenticado esteja sempre injetada na requisição.
 */
export function tenantMiddleware(req: AuthenticatedRequest, res: any, next: (err?: any) => void): void {
  if (!req.user || !req.user.igreja_id) {
    res.status(401).json({
      error: 'Não autenticado',
      message: 'Identificação da igreja ausente na sessão do usuário.'
    });
    return;
  }

  // Injeta o escopo obrigatório para as consultas
  req.igreja_id = req.user.igreja_id;
  next();
}
