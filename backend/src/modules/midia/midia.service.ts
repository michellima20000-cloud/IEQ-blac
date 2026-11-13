import { prisma } from '../../config/prisma.ts';
import { PermissaoError } from '../../permissions/rules.ts';
import type { UsuarioAutenticado } from '../../permissions/types.ts';
import type { CriarMidiaInput, AtualizarMidiaInput, DevolverMidiaInput } from './midia.schemas.ts';

/**
 * Arquivo binário enviado pelo usuário (vídeo).
 * Vai para o banco em bytes crus: base64 estourava a memória da API
 * (upload de 20 MB derrubava o servidor) e devolvia MBs no JSON.
 */
export interface ArquivoEnviado {
  bytes: Buffer;
  mimeType: string;
  nomeOriginal: string;
  tamanho: number;
}

/**
 * Campos devolvidos pela API. `arquivoBytes` fica de fora de propósito:
 * serializar um Buffer no JSON gera megabytes de array numérico.
 */
const selectMidia = {
  id: true,
  igreja_id: true,
  autorId: true,
  tipo: true,
  titulo: true,
  descricao: true,
  arquivoUrl: true,
  videoUrl: true,
  arquivoMimeType: true,
  nomeOriginal: true,
  tamanhoArquivoBytes: true,
  status: true,
  comentarioPastor: true,
  createdAt: true,
  updatedAt: true
} as const;

export class MidiaService {
  /**
   * Criação de conteúdo pela equipe de Mídia ou pelo Pastor
   */
  static async criar(usuario: UsuarioAutenticado, dados: CriarMidiaInput, arquivo?: ArquivoEnviado | null) {
    if (usuario.perfil !== 'MIDIA' && usuario.perfil !== 'PASTOR') {
      throw new PermissaoError('Apenas os perfis Mídia e Pastor podem criar conteúdos de divulgação.');
    }

    // Se for Pastor ou não precisar de aprovação, publica direto. Caso contrário, vai para PENDENTE.
    let status: 'PUBLICADO' | 'PENDENTE' = 'PUBLICADO';
    if (dados.precisaAprovacao || usuario.perfil === 'MIDIA') {
      status = dados.precisaAprovacao ? 'PENDENTE' : 'PUBLICADO';
    }

    const autorId = usuario.id || (usuario as any).sub;
    const criado = await prisma.conteudoMidia.create({
      data: {
        igreja_id: usuario.igreja_id,
        autorId,
        tipo: dados.tipo as any,
        titulo: dados.titulo,
        descricao: dados.descricao || null,
        arquivoUrl: dados.arquivoUrl || null,
        videoUrl: dados.videoUrl || null,
        status: status as any,
        ...(arquivo ? {
          arquivoBytes: arquivo.bytes,
          arquivoMimeType: arquivo.mimeType,
          nomeOriginal: arquivo.nomeOriginal,
          tamanhoArquivoBytes: arquivo.tamanho
        } : {})
      },
      select: selectMidia
    });

    // O arquivo binário é servido por /midia/:id/arquivo (com Range).
    // Guardamos o caminho relativo para o front montar a URL absoluta.
    if (arquivo) {
      return prisma.conteudoMidia.update({
        where: { id: criado.id },
        data: { arquivoUrl: `/midia/${criado.id}/arquivo` },
        select: selectMidia
      });
    }

    return criado;
  }

  /**
   * Vitrine pública para todos os usuários autenticados da igreja.
   * REGRA MANDATÓRIA: Conteúdo pendente, rascunho ou devolvido NUNCA aparece na vitrine.
   */
  static async listarVitrine(usuario: UsuarioAutenticado) {
    const where: any = {
      igreja_id: usuario.igreja_id,
      status: 'PUBLICADO'
    };
    if (usuario.perfil === 'MIDIA') {
      where.autorId = usuario.id || (usuario as any).sub;
    }
    return prisma.conteudoMidia.findMany({
      where,
      select: {
        ...selectMidia,
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

    const autorId = usuario.id || (usuario as any).sub;
    return prisma.conteudoMidia.findMany({
      where: {
        igreja_id: usuario.igreja_id,
        ...(usuario.perfil === 'MIDIA' ? { autorId } : {})
      },
      select: selectMidia,
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
      select: {
        ...selectMidia,
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
      },
      select: selectMidia
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
      },
      select: selectMidia
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
      where: { id, igreja_id: usuario.igreja_id },
      select: { id: true, tamanhoArquivoBytes: true }
    });

    if (!conteudo) {
      throw new Error('Conteúdo não encontrado.');
    }

    return prisma.conteudoMidia.update({
      where: { id },
      data: {
        ...(dados.titulo ? { titulo: dados.titulo } : {}),
        ...(dados.descricao !== undefined ? { descricao: dados.descricao } : {}),
        // O caminho do arquivo binário é gerado pelo servidor:
        // só pode ser trocado quando não existe arquivo gravado no banco.
        ...(dados.arquivoUrl !== undefined && !conteudo.tamanhoArquivoBytes
          ? { arquivoUrl: dados.arquivoUrl }
          : {}),
        ...(dados.videoUrl !== undefined ? { videoUrl: dados.videoUrl } : {}),
        ...(dados.reenviarAprovacao ? { status: 'PENDENTE' } : {})
      },
      select: selectMidia
    });
  }

  /**
   * Exclui um conteúdo de mídia. MIDIA só exclui o próprio conteúdo;
   * PASTOR pode excluir qualquer conteúdo da igreja.
   * Se houver constraints (relacionamentos) no banco, o delete pode falhar
   * e tentamos uma abordagem alternativa.
   */
  static async excluir(usuario: UsuarioAutenticado, id: string) {
    if (usuario.perfil !== 'MIDIA' && usuario.perfil !== 'PASTOR') {
      throw new PermissaoError('Acesso não autorizado.');
    }

    const where: any = { id, igreja_id: usuario.igreja_id };
    if (usuario.perfil === 'MIDIA') {
      where.autorId = usuario.id || (usuario as any).sub;
    }

    // Primeiro verifica se o conteúdo existe e pertence à igreja do usuário
    const existe = await prisma.conteudoMidia.findFirst({
      where: where,
    });
    if (!existe) {
      throw new Error('Conteúdo não encontrado nesta igreja.');
    }

    // Verifica constraint manualmente antes de deletar
    // Se houver foreign keys referenciando este conteúdo, o delete padrão falha
    try {
      return prisma.conteudoMidia.delete({ where: { id } });
    } catch (error: any) {
      // Se falhar por constraint, tenta deletar relations primeiro ou lança erro mais claro
      if (error.message && (error.message.includes('constraint') || error.message.includes('Foreign key'))) {
        throw new Error(
          'Não é possível excluir este conteúdo: há referências neste banco de dados. Contate o suporte para remover as dependências.'
        );
      }
      throw error;
    }
  }
}

