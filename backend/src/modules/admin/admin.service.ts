import { prisma } from '../../config/prisma.ts';
import { PermissaoError } from '../../permissions/rules.ts';
import type { UsuarioAutenticado } from '../../permissions/types.ts';
import { BackupService } from '../../services/backup.service.ts';
import { StorageService } from '../../services/storage.service.ts';
import { UsuariosService } from '../usuarios/usuarios.service.ts';
import type { CriarUsuarioInput, AtualizarUsuarioInput } from '../usuarios/usuarios.schemas.ts';

import { ENV } from '../../config/env.ts';

function formatarBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function emailDonoPermitido(email?: string | null): boolean {
  const donos = ENV.ADMIN_OWNER_EMAILS;
  if (!donos.length) return false; // sem dono configurado = acesso ADM bloqueado
  return donos.includes(String(email || '').trim().toLowerCase());
}

export class AdminService {
  private static exigirADM(usuario: UsuarioAutenticado & { email?: string }) {
    if (usuario.perfil !== 'ADM' || !emailDonoPermitido(usuario.email)) {
      throw new PermissaoError('Acesso restrito ao dono do sistema.');
    }
  }

  /**
   * Bootstrap do ADM dono: só funciona enquanto NÃO existe nenhum ADM no sistema.
   * Apenas o e-mail configurado em ADMIN_OWNER_EMAILS pode ser promovido/criado.
   */
  static async bootstrapAdm(dados: { email: string; senha: string; nome?: string; slugIgreja?: string }) {
    if (!emailDonoPermitido(dados.email)) {
      throw new PermissaoError('Bootstrap permitido apenas para o e-mail do dono do sistema (ADMIN_OWNER_EMAILS).', 403);
    }

    const jaExisteAdm = await prisma.usuario.findFirst({ where: { perfil: 'ADM' } });
    if (jaExisteAdm) {
      throw new PermissaoError('O sistema já possui um Administrador. Bootstrap indisponível.', 403);
    }

    const igreja = dados.slugIgreja
      ? await prisma.igreja.findUnique({ where: { slug: dados.slugIgreja } })
      : await prisma.igreja.findFirst({ orderBy: { createdAt: 'asc' } });

    if (!igreja) {
      throw new Error('Nenhuma igreja encontrada no sistema.');
    }

    const senhaHash = await (await import('../auth/auth.service.ts')).AuthService.hashSenha(dados.senha);

    const existente = await prisma.usuario.findFirst({
      where: { igreja_id: igreja.id, email: dados.email }
    });

    if (existente) {
      const promovido = await prisma.usuario.update({
        where: { id: existente.id },
        data: { perfil: 'ADM', ativo: true, senhaHash, redeId: null, celulaId: null },
        select: { id: true, nome: true, email: true, perfil: true, ativo: true }
      });
      return { acao: 'promovido', igreja: { id: igreja.id, nome: igreja.nome, slug: igreja.slug }, usuario: promovido };
    }

    const criado = await prisma.usuario.create({
      data: {
        igreja_id: igreja.id,
        nome: dados.nome || 'Administrador do Sistema',
        email: dados.email,
        senhaHash,
        perfil: 'ADM',
        ativo: true
      },
      select: { id: true, nome: true, email: true, perfil: true, ativo: true }
    });

    return { acao: 'criado', igreja: { id: igreja.id, nome: igreja.nome, slug: igreja.slug }, usuario: criado };
  }

  /**
   * Resumo global do sistema: igrejas, totais, backup e armazenamento
   */
  static async resumoSistema(usuario: UsuarioAutenticado) {
    this.exigirADM(usuario);

    const backup = BackupService.verificarStatusBackupParaPastor();

    const [totalIgrejas, totalUsuarios, totalCelulas, totalRelatorios, totalMidias, espacoUsadoBytes] = await Promise.all([
      prisma.igreja.count(),
      prisma.usuario.count({ where: { ativo: true } }),
      prisma.celula.count(),
      prisma.relatorioCelula.count(),
      prisma.conteudoMidia.count(),
      StorageService.obterEspacoUtilizado()
    ]);

    const igrejas = await prisma.igreja.findMany({
      select: {
        id: true,
        nome: true,
        slug: true,
        createdAt: true,
        _count: {
          select: {
            usuarios: true,
            celulas: true,
            redes: true,
            relatorios: true,
            conteudosMidia: true
          }
        }
      },
      orderBy: { nome: 'asc' }
    });

    return {
      totais: {
        igrejas: totalIgrejas,
        usuariosAtivos: totalUsuarios,
        celulas: totalCelulas,
        relatorios: totalRelatorios,
        midias: totalMidias
      },
      armazenamento: {
        espacoUsadoBytes,
        espacoUsadoFormatado: formatarBytes(espacoUsadoBytes)
      },
      segurancaBackup: backup,
      igrejas
    };
  }

  /**
   * Lista usuários de TODAS as igrejas com filtros opcionais
   */
  static async listarUsuarios(usuario: UsuarioAutenticado, filtros: { igrejaId?: string; perfil?: string }) {
    this.exigirADM(usuario);

    const perfisValidos = ['CELULA', 'REDE', 'MIDIA', 'PASTOR', 'ADM'];
    const perfil = filtros.perfil && perfisValidos.includes(filtros.perfil) ? filtros.perfil : undefined;

    return prisma.usuario.findMany({
      where: {
        ...(filtros.igrejaId ? { igreja_id: filtros.igrejaId } : {}),
        ...(perfil ? { perfil: perfil as any } : {})
      },
      select: {
        id: true,
        igreja_id: true,
        nome: true,
        email: true,
        perfil: true,
        redeId: true,
        celulaId: true,
        ativo: true,
        createdAt: true,
        igreja: { select: { id: true, nome: true, slug: true } },
        celula: {
          select: { id: true, nome: true, rede: { select: { id: true, nome: true } } }
        },
        rede: { select: { id: true, nome: true } }
      },
      orderBy: [{ igreja_id: 'asc' }, { nome: 'asc' }]
    });
  }

  /**
   * Cria um usuário em qualquer igreja
   */
  static async criarUsuario(usuario: UsuarioAutenticado, dados: CriarUsuarioInput & { igrejaId: string }) {
    this.exigirADM(usuario);

    const igreja = await prisma.igreja.findUnique({
      where: { id: dados.igrejaId },
      select: { id: true, nome: true }
    });
    if (!igreja) {
      throw new Error('Igreja não encontrada.');
    }

    const { igrejaId, ...resto } = dados;
    const novo = await UsuariosService.criar(igrejaId, resto as CriarUsuarioInput);
    return { igreja, usuario: novo };
  }

  /**
   * Atualiza um usuário de qualquer igreja
   */
  static async atualizarUsuario(usuario: UsuarioAutenticado, id: string, dados: AtualizarUsuarioInput) {
    this.exigirADM(usuario);

    const alvo = await prisma.usuario.findUnique({
      where: { id },
      select: { id: true, igreja_id: true, nome: true }
    });
    if (!alvo) {
      throw new Error('Usuário não encontrado.');
    }

    return UsuariosService.atualizar(alvo.igreja_id, id, dados, 'ADM');
  }

  /**
   * Exclui (ou desativa) um usuário de qualquer igreja
   */
  static async excluirUsuario(usuario: UsuarioAutenticado, id: string, idSolicitante?: string) {
    this.exigirADM(usuario);

    const alvo = await prisma.usuario.findUnique({
      where: { id },
      select: { id: true, igreja_id: true, nome: true }
    });
    if (!alvo) {
      throw new Error('Usuário não encontrado.');
    }

    return UsuariosService.excluir(alvo.igreja_id, id, idSolicitante);
  }

  /**
   * Logs de auditoria de todas as igrejas
   */
  static async listarAuditoria(usuario: UsuarioAutenticado, limite: number = 100) {
    this.exigirADM(usuario);

    const take = Math.min(Math.max(Number(limite) || 100, 1), 500);
    return prisma.logAuditoria.findMany({
      include: {
        igreja: { select: { id: true, nome: true, slug: true } },
        usuario: { select: { id: true, nome: true, email: true, perfil: true } }
      },
      orderBy: { createdAt: 'desc' },
      take
    });
  }
}
