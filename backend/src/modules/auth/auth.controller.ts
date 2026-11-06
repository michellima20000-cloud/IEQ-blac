import { Response } from 'express';
import { prisma } from '../../config/prisma.ts';
import { AuthService } from './auth.service.ts';
import type { LoginInput, RefreshInput } from './auth.schemas.ts';
import type { AuthenticatedRequest } from '../../middlewares/auth.ts';

export class AuthController {
  /**
   * POST /api/v1/auth/login
   */
  static async login(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { email, senha, slugIgreja } = req.body as LoginInput;

    // Localizar a igreja pelo slug
    const igreja = await prisma.igreja.findUnique({
      where: { slug: slugIgreja }
    });

    if (!igreja || !igreja.ativa) {
      res.status(401).json({
        error: 'Credenciais inválidas',
        message: 'Igreja não encontrada ou inativa.'
      });
      return;
    }

    // Localizar o usuário dentro da igreja informada (multicontas)
    const usuario = await prisma.usuario.findFirst({
      where: {
        email,
        igreja_id: igreja.id,
        ativo: true
      }
    });

    if (!usuario) {
      res.status(401).json({
        error: 'Credenciais inválidas',
        message: 'E-mail ou senha incorretos.'
      });
      return;
    }

    const senhaValida = await AuthService.verificarSenha(senha, usuario.senhaHash);
    if (!senhaValida) {
      res.status(401).json({
        error: 'Credenciais inválidas',
        message: 'E-mail ou senha incorretos.'
      });
      return;
    }

    const tokens = AuthService.gerarTokens({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil as any,
      igreja_id: usuario.igreja_id,
      redeId: usuario.redeId,
      celulaId: usuario.celulaId
    });

    res.json({
      message: 'Login realizado com sucesso',
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        igreja: {
          id: igreja.id,
          nome: igreja.nome,
          slug: igreja.slug
        }
      },
      ...tokens
    });
  }

  /**
   * POST /api/v1/auth/refresh
   */
  static async refresh(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { refreshToken } = req.body as RefreshInput;

    try {
      const payload = AuthService.verificarRefreshToken(refreshToken);

      const usuario = await prisma.usuario.findUnique({
        where: { id: payload.sub }
      });

      if (!usuario || !usuario.ativo || usuario.igreja_id !== payload.igreja_id) {
        res.status(401).json({
          error: 'Sessão inválida',
          message: 'Usuário não encontrado ou inativo.'
        });
        return;
      }

      // Revoga o token anterior (rotação de tokens)
      AuthService.revogarRefreshToken(refreshToken);

      const novosTokens = AuthService.gerarTokens({
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil as any,
        igreja_id: usuario.igreja_id,
        redeId: usuario.redeId,
        celulaId: usuario.celulaId
      });

      res.json({
        message: 'Tokens renovados com sucesso',
        ...novosTokens
      });
    } catch (err: any) {
      res.status(401).json({
        error: 'Token inválido',
        message: err.message || 'Falha ao renovar token.'
      });
    }
  }

  /**
   * POST /api/v1/auth/logout
   */
  static async logout(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { refreshToken } = req.body as RefreshInput;

    if (refreshToken) {
      AuthService.revogarRefreshToken(refreshToken);
    }

    res.json({
      message: 'Logout realizado com sucesso.'
    });
  }

  /**
   * GET /api/v1/auth/me
   */
  static async me(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    res.json({
      usuario: req.user
    });
  }
}

