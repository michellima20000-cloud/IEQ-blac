import type { Response } from 'express';
import { prisma } from '../../config/prisma.ts';
import { AuthService } from './auth.service.ts';
import type { LoginInput, RefreshInput } from './auth.schemas.ts';
import type { AuthenticatedRequest } from '../../middlewares/auth.ts';
import { candidatosSlug, normalizarSlug } from '../../utils/slug.ts';

function ehErroDeBanco(err: any): boolean {
  const code = String(err?.code || '');
  const msg = String(err?.message || err || '');
  const name = String(err?.name || '');
  return (
    /^P\d{4}$/.test(code) ||
    name.includes('PrismaClient') ||
    /can't reach database|database server|ECONNREFUSED|ENOTFOUND|connection/i.test(msg)
  );
}

function ehErroDeSchema(err: any): boolean {
  const code = String(err?.code || '');
  const msg = String(err?.message || err || '');
  return (
    /^P20(21|22|23|24|25)$/.test(code) ||
    /does not exist|Unknown argument|column .* does not|table .* does not/i.test(msg)
  );
}

export class AuthController {
  /**
   * POST /api/v1/auth/login
   */
  static async login(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      await this.executarLogin(req, res);
    } catch (err: any) {
      // Sem este try/catch, uma falha do banco deixava a requisição pendurada
      // (no Express 4, rejeição de handler assíncrono não chega ao errorHandler).
      console.error('[auth] Falha no login:', err?.stack || err?.message || err);
      if (ehErroDeSchema(err)) {
        res.status(503).json({
          error: 'Banco desatualizado',
          message: `O schema do banco precisa ser sincronizado (${err?.code || 'erro'}). Execute POST /api/v1/setup-db/sync.`
        });
        return;
      }
      if (ehErroDeBanco(err)) {
        res.status(503).json({
          error: 'Banco indisponível',
          message: 'Não foi possível conectar ao banco de dados. Verifique a configuração (DATABASE_URL) no servidor.'
        });
        return;
      }
      res.status(500).json({
        error: 'Erro no login',
        message: 'Não foi possível concluir o login. Tente novamente em instantes.',
        codigo: err?.code || null,
        detalhe: String(err?.message || err || '').slice(0, 200)
      });
    }
  }

  private static async executarLogin(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { email: emailRaw, senha, slugIgreja } = req.body as LoginInput;
    const email = String(emailRaw || '').trim();

    // Localizar a igreja pelo slug (aceita variações de escrita/caixa/espaços)
    let igreja = null;
    for (const candidato of candidatosSlug(slugIgreja)) {
      igreja = await prisma.igreja.findUnique({ where: { slug: candidato } });
      if (igreja) break;
    }
    // Fallback: busca pelo nome da igreja (ex.: "IEQ Cidade Nova")
    if (!igreja) {
      const alvo = normalizarSlug(slugIgreja).replace(/-/g, ' ');
      if (alvo) {
        igreja = await prisma.igreja.findFirst({
          where: { nome: { contains: alvo, mode: 'insensitive' } }
        });
      }
    }

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
        email: { equals: email, mode: 'insensitive' },
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

    let redeId = usuario.redeId;
    let celulaId = usuario.celulaId;

    // Se líder de célula não possui célula vinculada, vincula à primeira célula da igreja ou cria uma
    if (usuario.perfil === 'CELULA' && !celulaId) {
      let celula = await prisma.celula.findFirst({ where: { igreja_id: igreja.id } });
      if (!celula) {
        let rede = await prisma.rede.findFirst({ where: { igreja_id: igreja.id } });
        if (!rede) {
          rede = await prisma.rede.create({
            data: { nome: 'Rede Geral', igreja_id: igreja.id }
          });
        }
        celula = await prisma.celula.create({
          data: {
            nome: `Célula ${usuario.nome}`,
            diaSemana: 'Sábado',
            horario: '19:30',
            endereco: 'Sede da Igreja',
            redeId: rede.id,
            igreja_id: igreja.id
          }
        });
      }
      celulaId = celula.id;
      redeId = celula.redeId;
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { celulaId, redeId }
      });
    }

    // Se líder de rede não possui rede vinculada, vincula à primeira rede da igreja
    if (usuario.perfil === 'REDE' && !redeId) {
      let rede = await prisma.rede.findFirst({ where: { igreja_id: igreja.id } });
      if (!rede) {
        rede = await prisma.rede.create({
          data: { nome: 'Rede Geral', igreja_id: igreja.id }
        });
      }
      redeId = rede.id;
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { redeId }
      });
    }

    const tokens = AuthService.gerarTokens({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil as any,
      igreja_id: usuario.igreja_id,
      redeId,
      celulaId
    });

    res.json({
      message: 'Login realizado com sucesso',
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        redeId,
        celulaId,
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

