import type { Request, Response, NextFunction } from 'express';
import { ENV } from '../config/env.ts';

/**
 * Protege rotas de manutenção (setup do banco / bootstrap do ADM).
 *
 * Sem esse bloqueio qualquer pessoa com a URL da API poderia:
 *  - apagar todos os dados (seed com deleteMany) via /api/v1/setup-db;
 *  - se promover a ADM (e burlar o isolamento entre igrejas) via /admin/bootstrap.
 *
 * A chave vem da variável de ambiente SETUP_SECRET.
 * Se ela não estiver configurada, a rota fica desabilitada (503).
 */
export function exigirSegredoManutencao(req: Request, res: Response, next: NextFunction): void {
  if (!ENV.SETUP_SECRET) {
    res.status(503).json({
      status: 'desabilitado',
      message:
        'Rota de manutenção desabilitada: defina a variável de ambiente SETUP_SECRET para habilitá-la.'
    });
    return;
  }

  const informado =
    (req.headers['x-setup-secret'] as string | undefined) ||
    (req.query['setupSecret'] as string | undefined) ||
    '';

  if (informado !== ENV.SETUP_SECRET) {
    res.status(401).json({
      status: 'erro',
      message: 'Segredo de manutenção inválido.'
    });
    return;
  }

  next();
}
