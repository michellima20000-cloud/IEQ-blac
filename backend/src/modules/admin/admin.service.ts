import { prisma } from '../../config/prisma.ts';
import { PermissaoError } from '../../permissions/rules.ts';
import type { UsuarioAutenticado } from '../../permissions/types.ts';
import { BackupService } from '../../services/backup.service.ts';
import { StorageService } from '../../services/storage.service.ts';
import { UsuariosService } from '../usuarios/usuarios.service.ts';
import type { CriarUsuarioInput, AtualizarUsuarioInput } from '../usuarios/usuarios.schemas.ts';

function formatarBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export class AdminService {
  private static exigirADM(usuario: UsuarioAutenticado) {
    if (usuario.perfil !== 'ADM') {
      throw new PermissaoError('Acesso restrito ao Administrador do sistema.');
    }
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

    return prisma.usuario.findMany({
      where: {
        ...(filtros.igrejaId ? { igreja_id: filtros.igrejaId } : {}),
        ...(filtros.perfil ? { perfil: filtros.perfil as any } : {})
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

    return UsuariosService.atualizar(alvo.igreja_id, id, dados);
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
