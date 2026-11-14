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
  if (!donos.length) return true; // sem dono configurado = qualquer ADM acessa
  return donos.includes(String(email || '').trim().toLowerCase());
}

export class AdminService {
  private static exigirADM(usuario: UsuarioAutenticado & { email?: string }) {
    if (usuario.perfil !== 'ADM' || !emailDonoPermitido(usuario.email)) {
      throw new PermissaoError('Acesso restrito ao dono do sistema.');
    }
  }

  /**
   * Bootstrap do ADM dono: cria ou promove o e-mail do dono como ADM.
   * Apenas o e-mail configurado em ADMIN_OWNER_EMAILS pode ser promovido/criado.
   */
  static async bootstrapAdm(dados: { email: string; senha: string; nome?: string; slugIgreja?: string }) {
    const jaExisteAdm = await prisma.usuario.findFirst({ where: { perfil: 'ADM' } });

    // Janela de desbloqueio: se ainda não existe nenhum ADM, permite criar o
    // primeiro sem exigir ADMIN_OWNER_EMAILS nem SETUP_SECRET (útil quando as
    // variáveis de ambiente não foram configuradas no painel do Render).
    // Após existir um ADM, só o dono (ADMIN_OWNER_EMAILS) pode usar esta rota.
    if (jaExisteAdm && !emailDonoPermitido(dados.email)) {
      throw new PermissaoError('Bootstrap permitido apenas para o e-mail do dono do sistema (ADMIN_OWNER_EMAILS).', 403);
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
   * Exclui uma igreja e todos os seus dados relacionados (usuários, células,
   * redes, membros, relatórios, mídias, etc.). Não exclui se for a única
   * igreja do sistema.
   */
  static async excluirIgreja(id: string) {
    const igreja = await prisma.igreja.findUnique({ where: { id } });
    if (!igreja) {
      throw new Error('Igreja não encontrada.');
    }

    const totalIgrejas = await prisma.igreja.count();
    if (totalIgrejas <= 1) {
      throw new Error('Não é possível excluir a única igreja do sistema.');
    }

    // Exclui dados relacionados em ordem (respeitando foreign keys)
    await prisma.midiaArquivoParte.deleteMany({ where: { conteudo: { igreja_id: id } } });
    await prisma.conteudoMidia.deleteMany({ where: { igreja_id: id } });
    await prisma.membro.deleteMany({ where: { igreja_id: id } });
    await prisma.visitante.deleteMany({ where: { igreja_id: id } });
    await prisma.relatorioCelula.deleteMany({ where: { igreja_id: id } });
    await prisma.celula.deleteMany({ where: { igreja_id: id } });
    await prisma.rede.deleteMany({ where: { igreja_id: id } });
    await prisma.eventoCalendario.deleteMany({ where: { igreja_id: id } });
    await prisma.arquivoIgreja.deleteMany({ where: { igreja_id: id } });
    await prisma.configuracaoIgreja.delete({ where: { igreja_id: id } }).catch(() => {});
    await prisma.usuario.deleteMany({ where: { igreja_id: id } });
    await prisma.logAuditoria.deleteMany({ where: { igreja_id: id } });

    await prisma.igreja.delete({ where: { id } });

    return { acao: 'excluida', igreja: { id, nome: igreja.nome, slug: igreja.slug } };
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

  static async listarIgrejas(usuario: UsuarioAutenticado) {
    this.exigirADM(usuario);
    return prisma.igreja.findMany({
      select: {
        id: true, nome: true, slug: true, ativa: true, createdAt: true, updatedAt: true,
        _count: { select: { usuarios: true, celulas: true, redes: true, relatorios: true, conteudosMidia: true, membros: true, visitantes: true } }
      },
      orderBy: { nome: 'asc' }
    });
  }

  static async criarIgreja(usuario: UsuarioAutenticado, dados: { nome: string; slug: string; ativa?: boolean }) {
    this.exigirADM(usuario);
    const slug = dados.slug.trim().toLowerCase();
    const existente = await prisma.igreja.findUnique({ where: { slug } });
    if (existente) throw new Error('Já existe uma igreja com este slug.');
    return prisma.igreja.create({
      data: { nome: dados.nome.trim(), slug, ativa: dados.ativa !== false },
      select: { id: true, nome: true, slug: true, ativa: true, createdAt: true, updatedAt: true }
    });
  }

  static async atualizarIgreja(usuario: UsuarioAutenticado, id: string, dados: { nome?: string; slug?: string; ativa?: boolean }) {
    this.exigirADM(usuario);
    const igreja = await prisma.igreja.findUnique({ where: { id } });
    if (!igreja) throw new Error('Igreja não encontrada.');
    if (dados.slug) {
      const slug = dados.slug.trim().toLowerCase();
      const conflito = await prisma.igreja.findFirst({ where: { slug, NOT: { id } } });
      if (conflito) throw new Error('Já existe outra igreja com este slug.');
      (dados as any).slug = slug;
    }
    if (dados.nome) (dados as any).nome = dados.nome.trim();
    return prisma.igreja.update({
      where: { id },
      data: dados as any,
      select: { id: true, nome: true, slug: true, ativa: true, createdAt: true, updatedAt: true }
    });
  }
}
