import { Response } from 'express';
import { UsuariosService } from './usuarios.service.ts';
import type { AuthenticatedRequest } from '../../middlewares/auth.ts';
import type { CriarUsuarioInput, AtualizarUsuarioInput } from './usuarios.schemas.ts';

export class UsuariosController {
  /**
   * POST /api/v1/usuarios
   * Criação de líderes de célula, líderes de rede e equipe de mídia (Restrito ao Pastor)
   */
  static async criar(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const igreja_id = req.igreja_id!;
      const dados = req.body as CriarUsuarioInput;

      const usuarioCriado = await UsuariosService.criar(igreja_id, dados);

      res.status(201).json({
        message: 'Usuário cadastrado com sucesso pelo pastor.',
        usuario: usuarioCriado
      });
    } catch (err: any) {
      res.status(400).json({
        error: 'Erro no cadastro',
        message: err.message || 'Falha ao cadastrar usuário.'
      });
    }
  }

  /**
   * GET /api/v1/usuarios
   * Lista usuários da igreja do pastor
   */
  static async listar(req: AuthenticatedRequest, res: Response): Promise<void> {
    const igreja_id = req.igreja_id!;
    const { perfil } = req.query;

    const usuarios = await UsuariosService.listar(igreja_id, perfil as string);

    res.json({
      total: usuarios.length,
      usuarios
    });
  }

  /**
   * GET /api/v1/usuarios/:id
   */
  static async buscarPorId(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const igreja_id = req.igreja_id!;
      const { id } = req.params;

      const usuario = await UsuariosService.buscarPorId(igreja_id, id);

      res.json({ usuario });
    } catch (err: any) {
      res.status(404).json({
        error: 'Não encontrado',
        message: err.message
      });
    }
  }

  /**
   * PATCH /api/v1/usuarios/:id
   */
  static async atualizar(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const igreja_id = req.igreja_id!;
      const { id } = req.params;
      const dados = req.body as AtualizarUsuarioInput;

      const atualizado = await UsuariosService.atualizar(igreja_id, id, dados);

      res.json({
        message: 'Usuário atualizado com sucesso.',
        usuario: atualizado
      });
    } catch (err: any) {
      res.status(400).json({
        error: 'Erro ao atualizar',
        message: err.message
      });
    }
  }
}

