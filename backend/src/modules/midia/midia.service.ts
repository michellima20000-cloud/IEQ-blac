import { createReadStream } from 'node:fs';
import { prisma } from '../../config/prisma.ts';
import { PermissaoError } from '../../permissions/rules.ts';
import type { UsuarioAutenticado } from '../../permissions/types.ts';
import type { CriarMidiaInput, AtualizarMidiaInput, DevolverMidiaInput } from './midia.schemas.ts';
import { TAMANHO_PARTE_ARQUIVO, caminhoArquivoMidia, dividirEmPartes, extrairDataUrl } from '../../utils/upload.ts';

/**
 * Arquivo enviado pelo usuário (foto ou vídeo).
 * `caminho`: arquivo no disco (vídeo grande, lido em fluxo).
 * `buffer`: conteúdo já processado em memória (imagem convertida para WebP).
 * Nos dois casos os bytes vão para o banco em pedaços de 4 MB.
 */
export interface ArquivoEnviado {
  caminho?: string;
  buffer?: Buffer;
  mimeType: string;
  nomeOriginal: string;
  tamanho: number;
}

/**
 * Campos devolvidos pela API. Os bytes do arquivo NÃO entram aqui:
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
  static async criar(usuario: UsuarioAutenticado, dados: CriarMidiaInput) {
    if (usuario.perfil !== 'MIDIA' && usuario.perfil !== 'PASTOR') {
      throw new PermissaoError('Apenas os perfis Mídia e Pastor podem criar conteúdos de divulgação.');
    }

    // Se for Pastor ou não precisar de aprovação, publica direto. Caso contrário, vai para PENDENTE.
    let status: 'PUBLICADO' | 'PENDENTE' = 'PUBLICADO';
    if (dados.precisaAprovacao || usuario.perfil === 'MIDIA') {
      status = dados.precisaAprovacao ? 'PENDENTE' : 'PUBLICADO';
    }

    const autorId = usuario.id || (usuario as any).sub;
    return prisma.conteudoMidia.create({
      data: {
        igreja_id: usuario.igreja_id,
        autorId,
        tipo: dados.tipo as any,
        titulo: dados.titulo,
        descricao: dados.descricao || null,
        arquivoUrl: dados.arquivoUrl || null,
        videoUrl: dados.videoUrl || null,
        status: status as any
      },
      select: selectMidia
    });
  }

  /**
   * Grava o arquivo enviado (foto ou vídeo) no banco, em pedaços de 4 MB.
   * O arquivo é lido do disco em fluxo (vídeo) ou dividido em memória (imagem):
   * a memória da API nunca precisa segurar o arquivo inteiro.
   */
  static async salvarArquivo(conteudoId: string, arquivo: ArquivoEnviado) {
    const inserirParte = async (bytes: Buffer, ordem: number) => {
      await prisma.midiaArquivoParte.create({
        data: {
          conteudoId,
          ordem,
          bytes,
          tamanho: bytes.length
        }
      });
    };

    try {
      if (arquivo.buffer) {
        const partes = dividirEmPartes(arquivo.buffer);
        for (let ordem = 0; ordem < partes.length; ordem++) {
          await inserirParte(partes[ordem], ordem);
        }
      } else if (arquivo.caminho) {
        const stream = createReadStream(arquivo.caminho, { highWaterMark: TAMANHO_PARTE_ARQUIVO });
        let ordem = 0;
        for await (const pedaco of stream) {
          const bytes = pedaco as Buffer;
          if (bytes.length === 0) continue;
          await inserirParte(bytes, ordem++);
        }
      }
    } catch (erro) {
      // Não deixa metade do arquivo no banco
      await prisma.midiaArquivoParte.deleteMany({ where: { conteudoId } });
      throw erro;
    }

    // O arquivo é servido por /midia/:id/arquivo (com Range).
    // Guardamos o caminho relativo para o front montar a URL absoluta.
    return prisma.conteudoMidia.update({
      where: { id: conteudoId },
      data: {
        arquivoUrl: caminhoArquivoMidia(conteudoId),
        arquivoMimeType: arquivo.mimeType,
        nomeOriginal: arquivo.nomeOriginal,
        tamanhoArquivoBytes: arquivo.tamanho
      },
      select: selectMidia
    });
  }

  /**
   * Migração das mídias antigas: fotos que estavam guardadas como texto
   * base64 dentro de `arquivoUrl` passam a ficar gravadas no banco como
   * bytes (mesma tabela usada pelos vídeos). A vitrine fica leve: a resposta
   * deixa de carregar megabytes de base64.
   */
  static async migrarArquivosLegados(): Promise<number> {
    const legados = await prisma.conteudoMidia.findMany({
      where: { arquivoUrl: { startsWith: 'data:' } },
      select: { id: true, arquivoUrl: true }
    });

    let migrados = 0;
    for (const item of legados) {
      const extraido = extrairDataUrl(item.arquivoUrl || '');
      if (!extraido) continue;

      const partesExistentes = await prisma.midiaArquivoParte.count({ where: { conteudoId: item.id } });
      if (partesExistentes === 0) {
        const partes = dividirEmPartes(extraido.bytes);
        for (let ordem = 0; ordem < partes.length; ordem++) {
          await prisma.midiaArquivoParte.create({
            data: { conteudoId: item.id, ordem, bytes: partes[ordem], tamanho: partes[ordem].length }
          });
        }
      }

      await prisma.conteudoMidia.update({
        where: { id: item.id },
        data: {
          arquivoUrl: caminhoArquivoMidia(item.id),
          arquivoMimeType: extraido.mimeType,
          tamanhoArquivoBytes: extraido.bytes.length
        }
      });
      migrados++;
    }

    return migrados;
  }

  /**
   * Metadados dos pedaços (sem os bytes) + tamanho total do arquivo.
   * Usado para responder com Range sem carregar o vídeo inteiro na memória.
   */
  static async listarPartes(conteudoId: string) {
    const partes = await prisma.midiaArquivoParte.findMany({
      where: { conteudoId },
      orderBy: { ordem: 'asc' },
      select: { id: true, ordem: true, tamanho: true }
    });
    const total = partes.reduce((soma, parte) => soma + parte.tamanho, 0);
    return { partes, total };
  }

  /** Bytes de um pedaço específico do arquivo. */
  static async obterParte(parteId: string): Promise<Buffer | null> {
    const parte = await prisma.midiaArquivoParte.findUnique({
      where: { id: parteId },
      select: { bytes: true }
    });
    if (!parte) return null;
    const bytes = parte.bytes as any;
    return Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
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

