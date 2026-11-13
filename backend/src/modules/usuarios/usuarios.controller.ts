import type { Response } from 'express';
import { UsuariosService } from './usuarios.service.ts';
import type { AuthenticatedRequest } from '../../middlewares/auth.ts';
import type { CriarUsuarioInput, AtualizarUsuarioInput } from './usuarios.schemas.ts';
import { PERFIS_GERENCIAVEIS } from './usuarios.schemas.ts';

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
    try {
      const igreja_id = req.igreja_id!;
      const { perfil } = req.query;

      // O filtro vai direto para o Prisma: precisa ser um perfil válido,
      // senão a consulta estoura e a requisição fica pendurada.
      const perfilValido = PERFIS_GERENCIAVEIS.includes(perfil as any)
        ? (perfil as string)
        : undefined;

      const usuarios = await UsuariosService.listar(igreja_id, perfilValido);

      res.json({
        total: usuarios.length,
        usuarios
      });
    } catch (err: any) {
      res.status(400).json({
        error: 'Erro ao listar usuários',
        message: err.message || 'Falha ao listar usuários.'
      });
    }
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

      const atualizado = await UsuariosService.atualizar(
        igreja_id,
        id,
        dados,
        req.user?.perfil as string | undefined
      );

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

  /**
   * DELETE /api/v1/usuarios/:id
   * Exclui o usuário; se houver dados vinculados, apenas o desativa
   */
  static async excluir(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const igreja_id = req.igreja_id!;
      const { id } = req.params;

      const resultado = await UsuariosService.excluir(igreja_id, id, req.user?.sub);

      res.json({
        message: resultado.mensagem,
        modo: resultado.modo,
        usuario: resultado.usuario
      });
    } catch (err: any) {
      res.status(400).json({
        error: 'Erro ao excluir',
        message: err.message
      });
    }
  }
}

