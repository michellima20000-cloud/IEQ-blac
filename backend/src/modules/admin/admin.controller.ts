import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../middlewares/auth.ts';
import { AdminService } from './admin.service.ts';

export class AdminController {
  private static responder(res: Response, acao: () => Promise<any>) {
    acao().then((dados) => res.json(dados)).catch((err: any) => {
      res.status(err.statusCode || 400).json({ error: err.name || 'Erro', message: err.message });
    });
  }

  static async resumoSistema(req: AuthenticatedRequest, res: Response): Promise<void> {
    this.responder(res, () => AdminService.resumoSistema(req.user as any));
  }

  static async listarUsuarios(req: AuthenticatedRequest, res: Response): Promise<void> {
    const filtros = req.query as any;
    this.responder(res, () => AdminService.listarUsuarios(req.user as any, {
      igrejaId: filtros.igrejaId,
      perfil: filtros.perfil
    }));
  }

  static async criarUsuario(req: AuthenticatedRequest, res: Response): Promise<void> {
    this.responder(res, () => AdminService.criarUsuario(req.user as any, req.body as any));
  }

  static async atualizarUsuario(req: AuthenticatedRequest, res: Response): Promise<void> {
    this.responder(res, () => AdminService.atualizarUsuario(req.user as any, req.params.id, req.body as any));
  }

  static async excluirUsuario(req: AuthenticatedRequest, res: Response): Promise<void> {
    const idSolicitante = (req.user as any)?.id || (req.user as any)?.sub;
    this.responder(res, () => AdminService.excluirUsuario(req.user as any, req.params.id, idSolicitante));
  }

  static async listarAuditoria(req: AuthenticatedRequest, res: Response): Promise<void> {
    const limite = (req.query as any).limite;
    this.responder(res, () => AdminService.listarAuditoria(req.user as any, limite));
  }
}
