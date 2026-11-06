import { prisma } from '../../config/prisma.ts';
import { PermissaoError } from '../../permissions/rules.ts';
import type { UsuarioAutenticado } from '../../permissions/types.ts';
import type { CriarMidiaInput, AtualizarMidiaInput, DevolverMidiaInput } from './midia.schemas.ts';

export class MidiaService {
  /**
   * Criação de conteúdo pela equipe de Mídia ou pelo Pastor
   */
  static async criar(usuario: UsuarioAutenticado, dados: CriarMidiaInput) {
    if (usuario.perfil !== 'MIDIA' && usuario.perfil !== 'PASTOR') {
      throw new PermissaoError('Apenas os perfis Mídia e Pastor podem criar conteúdos de divulgação.');
    }

    // Se for Pastor ou não precisar de aprovação, publica direto. Caso contrário, vai para PENDENTE.
    let status: 'PUBLICADO' | 'PENDENTE' = 'PUBLICADO';
    if (dados.precisaAprovacao || usuario.perfil === 'MIDIA') {
      status = dados.precisaAprovacao ? 'PENDENTE' : 'PUBLICADO';
    }

    return prisma.conteudoMidia.create({
      data: {
        igreja_id: usuario.igreja_id,
        autorId: usuario.id,
        tipo: dados.tipo as any,
        titulo: dados.titulo,
        descricao: dados.descricao || null,
        arquivoUrl: dados.arquivoUrl || null,
        videoUrl: dados.videoUrl || null,
        status: status as any
      }
    });
  }

  /**
   * Vitrine pública para todos os usuários autenticados da igreja.
   * REGRA MANDATÓRIA: Conteúdo pendente, rascunho ou devolvido NUNCA aparece na vitrine.
   */
  static async listarVitrine(usuario: UsuarioAutenticado) {
    return prisma.conteudoMidia.findMany({
      where: {
        igreja_id: usuario.igreja_id,
        status: 'PUBLICADO'
      },
      include: {
        autor: {
          select: { id: true, nome: true, perfil: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Conteúdos cadastrados pela equipe de mídia (inclui rascunhos, pendentes e devolvidos)
   */
  static async listarMinhas(usuario: UsuarioAutenticado) {
    if (usuario.perfil !== 'MIDIA' && usuario.perfil !== 'PASTOR') {
      throw new PermissaoError('Acesso restrito à Mídia e Pastor.');
    }

    return prisma.conteudoMidia.findMany({
      where: {
        igreja_id: usuario.igreja_id,
        ...(usuario.perfil === 'MIDIA' ? { autorId: usuario.id } : {})
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Lista de conteúdos pendentes aguardando aprovação (Exclusivo do Pastor)
   */
  static async listarPendentes(usuario: UsuarioAutenticado) {
    if (usuario.perfil !== 'PASTOR') {
      throw new PermissaoError('Apenas o Pastor pode visualizar e gerenciar conteúdos pendentes de aprovação.');
    }

    return prisma.conteudoMidia.findMany({
      where: {
        igreja_id: usuario.igreja_id,
        status: 'PENDENTE'
      },
      include: {
        autor: {
          select: { id: true, nome: true, email: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  /**
   * Aprovação de conteúdo (Exclusivo do Pastor)
   */
  static async aprovar(usuario: UsuarioAutenticado, id: string) {
    if (usuario.perfil !== 'PASTOR') {
      throw new PermissaoError('Apenas o Pastor possui permissão para aprovar publicações.');
    }

    const conteudo = await prisma.conteudoMidia.findFirst({
      where: { id, igreja_id: usuario.igreja_id }
    });

    if (!conteudo) {
      throw new Error('Conteúdo não encontrado nesta igreja.');
    }

    return prisma.conteudoMidia.update({
      where: { id },
      data: {
        status: 'PUBLICADO',
        comentarioPastor: null
      }
    });
  }

  /**
   * Devolução de conteúdo com comentário para correção (Exclusivo do Pastor)
   */
  static async devolver(usuario: UsuarioAutenticado, id: string, dados: DevolverMidiaInput) {
    if (usuario.perfil !== 'PASTOR') {
      throw new PermissaoError('Apenas o Pastor possui permissão para devolver publicações.');
    }

    const conteudo = await prisma.conteudoMidia.findFirst({
      where: { id, igreja_id: usuario.igreja_id }
    });

    if (!conteudo) {
      throw new Error('Conteúdo não encontrado nesta igreja.');
    }

    return prisma.conteudoMidia.update({
      where: { id },
      data: {
        status: 'DEVOLVIDO',
        comentarioPastor: dados.comentarioPastor
      }
    });
  }

  /**
   * Mídia corrige e reenvia conteúdo devolvido para aprovação
   */
  static async atualizarEReenviar(usuario: UsuarioAutenticado, id: string, dados: AtualizarMidiaInput) {
    if (usuario.perfil !== 'MIDIA' && usuario.perfil !== 'PASTOR') {
      throw new PermissaoError('Acesso não autorizado.');
    }

    const conteudo = await prisma.conteudoMidia.findFirst({
      where: { id, igreja_id: usuario.igreja_id }
    });

    if (!conteudo) {
      throw new Error('Conteúdo não encontrado.');
    }

    return prisma.conteudoMidia.update({
      where: { id },
      data: {
        ...(dados.titulo ? { titulo: dados.titulo } : {}),
        ...(dados.descricao !== undefined ? { descricao: dados.descricao } : {}),
        ...(dados.arquivoUrl !== undefined ? { arquivoUrl: dados.arquivoUrl } : {}),
        ...(dados.videoUrl !== undefined ? { videoUrl: dados.videoUrl } : {}),
        ...(dados.reenviarAprovacao ? { status: 'PENDENTE' } : {})
      }
    });
  }
}

