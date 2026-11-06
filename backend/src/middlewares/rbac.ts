import type { AuthenticatedRequest } from './auth.ts';
import type { Perfil } from '../permissions/types.ts';

/**
 * Middleware para restringir endpoints a perfis específicos (ex: apenas PASTOR)
 */
export function requirePerfil(...perfisPermitidos: Perfil[]) {
  return (req: AuthenticatedRequest, res: any, next: (err?: any) => void): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Não autenticado',
        message: 'Autenticação necessária para acessar este recurso.'
      });
      return;
    }

    if (!perfisPermitidos.includes(req.user.perfil)) {
      res.status(403).json({
        error: 'Acesso negado',
        message: `O perfil '${req.user.perfil}' não possui permissão para executar esta ação.`
      });
      return;
    }

    next();
  };
}
