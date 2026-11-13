import type { Response } from 'express';
import { readFile, unlink, writeFile, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prisma } from '../../config/prisma.ts';
import { ENV } from '../../config/env.ts';
import { verifyJwt } from '../../config/cryptoUtils.ts';
import { MidiaService, type ArquivoEnviado } from './midia.service.ts';
import { CalendarioService } from './calendario.service.ts';
import { VisualService } from './visual.service.ts';
import { criarMidiaSchema } from './midia.schemas.ts';
import { ImageProcessor, detectarMimeType, mimeDeVideoValido } from '../../services/imageProcessor.ts';
import { normalizarArquivos } from '../../utils/upload.ts';
import { cacheDel, cacheGet, cacheSet, chavesCache } from '../../config/upstash.ts';
import type { AuthenticatedRequest } from '../../middlewares/auth.ts';
import type {
  CriarMidiaInput,
  AtualizarMidiaInput,
  DevolverMidiaInput,
  CriarEventoInput,
  AtualizarEventoInput,
  PersonalizacaoVisualInput
} from './midia.schemas.ts';

export class MidiaController {
  // --- MÍDIA & VITRINE ---
  static async criar(req: AuthenticatedRequest, res: Response): Promise<void> {
    // O multer.array('arquivos') pode retornar undefined (nenhum arquivo) ou um array de file objects
    // O multer pode entregar os arquivos como array (campo único) ou objeto
    // (vários campos aceitos). A normalização garante os dois formatos.
    const arquivos = normalizarArquivos((req as any).files);
    const temporarios: string[] = [];

    try {
      let arquivoUrl: string | null = null;
      let arquivoVideo: ArquivoEnviado | null = null;
      let tamanhoArquivoBytes = 0;
      let arquivoEhVideo = false;

      if (arquivos && arquivos.length > 0) {
        // Processa apenas o primeiro arquivo selecionado (para manter compatibilidade com o schema único de arquivoUrl)
        const arquivo = arquivos[0];
        const mimeEnviado = String(arquivo.mimetype || '').toLowerCase();
        const caminho = await MidiaController.caminhoDoArquivo(arquivo, temporarios);

        if (mimeEnviado.startsWith('video/')) {
          // VÍDEO: o arquivo vai para o banco em pedaços de 4 MB.
          // Base64 (ou até um bytea gigante) estourava a memória da API e
          // derrubava o servidor: upload acima de ~15 MB voltava com 502.
          const mimeReal = detectarMimeType(await MidiaController.lerInicio(caminho, 32));
          const mimeType = mimeDeVideoValido(mimeReal) ? mimeReal : mimeEnviado;
          arquivoVideo = {
            caminho,
            mimeType,
            nomeOriginal: arquivo.originalname,
            tamanho: Number(arquivo.size) || 0
          };
          tamanhoArquivoBytes = arquivoVideo.tamanho;
          arquivoEhVideo = true;
        } else {
          // IMAGEM: converte para WebP e guarda como data URL (comportamento antigo).
          const buffer = await readFile(caminho);
          const processed = await ImageProcessor.processToWebP(buffer, {
            maxWidth: 1280,
            quality: 80
          });
          arquivoUrl = `data:${processed.mimeType};base64,${processed.buffer.toString('base64')}`;
          tamanhoArquivoBytes = processed.buffer.length;
        }
      }

      const precisaAprovacao =
        req.body.precisaAprovacao === true || req.body.precisaAprovacao === 'true';

      const dados: CriarMidiaInput = arquivos && arquivos.length > 0
        ? await criarMidiaSchema.parseAsync({
            // Vídeo enviado com outro tipo (ex.: BANNER) vira VIDEO:
            // senão a vitrine tentaria mostrar o arquivo como imagem.
            tipo: arquivoEhVideo ? 'VIDEO' : req.body.tipo,
            titulo: req.body.titulo,
            descricao: req.body.descricao || null,
            videoUrl: req.body.videoUrl || null,
            precisaAprovacao,
            temArquivo: true,
            tamanhoArquivoBytes,
            ...(arquivoUrl ? { arquivoUrl } : {})
          })
        : await criarMidiaSchema.parseAsync({
            ...req.body,
            precisaAprovacao
          });

      const criado = await MidiaService.criar(req.user as any, dados);

      let conteudo = criado;
      if (arquivoVideo) {
        try {
          conteudo = await MidiaService.salvarArquivo(criado.id, arquivoVideo);
        } catch (erro) {
          // Não deixa conteúdo sem arquivo publicado
          await prisma.conteudoMidia.delete({ where: { id: criado.id } }).catch(() => undefined);
          throw erro;
        }
      }

      // Qualquer criação pode mudar o que aparece na vitrine
      await cacheDel(chavesCache.vitrine(req.user!.igreja_id), chavesCache.vitrinePublica(req.user!.igreja_id));
      res.status(201).json({
        message: conteudo.status === 'PENDENTE'
          ? 'Conteúdo enviado para aprovação do Pastor.'
          : 'Conteúdo publicado diretamente na vitrine.',
        conteudo
      });
    } catch (err: any) {
      res.status(err.statusCode || 400).json({ error: err.name || 'Erro', message: err.message });
    } finally {
      // Os arquivos temporários do upload são apagados sempre
      await Promise.all(
        temporarios.map((caminho) => unlink(caminho).catch(() => undefined))
      );
    }
  }

  /**
   * Caminho do arquivo enviado (o multer grava em disco).
   * Se vier em memória (integrações antigas), grava em arquivo temporário.
   */
  private static async caminhoDoArquivo(arquivo: any, temporarios: string[]): Promise<string> {
    if (arquivo?.path) return String(arquivo.path);

    const buffer: Buffer | undefined = arquivo?.buffer;
    if (!buffer) {
      throw new Error('Arquivo não encontrado no upload.');
    }
    const caminho = join(tmpdir(), `ieq-midia-${Date.now()}-${Math.round(Math.random() * 1e9)}.bin`);
    await writeFile(caminho, buffer);
    temporarios.push(caminho);
    return caminho;
  }

  /** Lê os primeiros bytes do arquivo (para identificar o formato real). */
  private static async lerInicio(caminho: string, quantidade: number): Promise<Buffer> {
    const arquivo = await open(caminho, 'r');
    try {
      const buffer = Buffer.alloc(quantidade);
      const { bytesRead } = await arquivo.read(buffer, 0, quantidade, 0);
      return buffer.subarray(0, bytesRead);
    } finally {
      await arquivo.close();
    }
  }

  // --- ARQUIVO DO CONTEÚDO (VÍDEO GRAVADO NO BANCO EM PEDAÇOS) ---
  /**
   * Serve o arquivo do conteúdo (vídeo enviado pela equipe de Mídia).
   *
   * - Conteúdo PUBLICADO é público (é o que aparece na vitrine compartilhável).
   * - Os demais exigem um usuário autenticado da mesma igreja.
   * - Suporta Range para o navegador conseguir navegar/assistir o vídeo.
   * - Os pedaços (4 MB cada) são lidos um de cada vez: a memória não carrega
   *   o vídeo inteiro.
   */
  static async servirArquivo(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const conteudo = await prisma.conteudoMidia.findUnique({
        where: { id },
        select: {
          id: true,
          igreja_id: true,
          status: true,
          titulo: true,
          arquivoMimeType: true,
          nomeOriginal: true
        }
      });

      if (!conteudo) {
        res.status(404).json({ error: 'NaoEncontrado', message: 'Arquivo não encontrado.' });
        return;
      }

      const { partes, total } = await MidiaService.listarPartes(id);
      if (!partes.length || total === 0) {
        res.status(404).json({ error: 'NaoEncontrado', message: 'Arquivo não encontrado.' });
        return;
      }

      if (conteudo.status !== 'PUBLICADO' && !MidiaController.usuarioDaMesmaIgreja(req, conteudo.igreja_id)) {
        res.status(404).json({ error: 'NaoEncontrado', message: 'Arquivo não encontrado.' });
        return;
      }

      let inicio = 0;
      let fim = total - 1;
      let parcial = false;

      const range = req.headers.range;
      const match = range ? /bytes=(\d*)-(\d*)/.exec(String(range)) : null;
      if (match) {
        parcial = true;
        inicio = match[1] ? parseInt(match[1], 10) : 0;
        fim = match[2] ? parseInt(match[2], 10) : total - 1;
        if (Number.isNaN(inicio) || inicio < 0) inicio = 0;
        if (Number.isNaN(fim) || fim >= total) fim = total - 1;

        if (inicio > fim || inicio >= total) {
          res.status(416).setHeader('Content-Range', `bytes */${total}`);
          res.end();
          return;
        }
      }

      res.setHeader('Content-Type', conteudo.arquivoMimeType || 'application/octet-stream');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader(
        'Cache-Control',
        conteudo.status === 'PUBLICADO' ? 'public, max-age=86400' : 'private, max-age=3600'
      );
      res.setHeader('Content-Length', String(fim - inicio + 1));
      if (conteudo.nomeOriginal) {
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(conteudo.nomeOriginal)}"`);
      }
      if (parcial) {
        res.status(206);
        res.setHeader('Content-Range', `bytes ${inicio}-${fim}/${total}`);
      }

      // Envia apenas os pedaços que intersectam o intervalo pedido
      let posicao = 0;
      for (const parte of partes) {
        const parteInicio = posicao;
        const parteFim = posicao + parte.tamanho - 1;
        posicao = parteFim + 1;

        if (parteFim < inicio || parteInicio > fim) continue;

        const bytes = await MidiaService.obterParte(parte.id);
        if (!bytes || bytes.length === 0) continue;

        const corteInicio = Math.max(0, inicio - parteInicio);
        const corteFim = Math.min(bytes.length - 1, fim - parteInicio);
        if (corteFim < corteInicio) continue;

        res.write(bytes.subarray(corteInicio, corteFim + 1));
      }

      res.end();
    } catch (err: any) {
      res.status(err.statusCode || 400).json({ error: err.name || 'Erro', message: err.message });
    }
  }

  /**
   * Usuário autorizado a ver um arquivo que ainda não foi publicado.
   * Aceita o header Authorization (Bearer) ou um token assinado na query string
   * (?token=...) — o <video> do navegador não envia header, então a query
   * é o jeito de a equipe de Mídia pré-visualizar o conteúdo pendente.
   */
  private static usuarioDaMesmaIgreja(req: AuthenticatedRequest, igrejaId: string): boolean {
    const header = req.headers.authorization;
    let token: string | null = null;

    if (header) {
      const partes = String(header).split(' ');
      if (partes.length === 2 && partes[0] === 'Bearer') token = partes[1];
    }

    if (!token) {
      const query = (req.query || {}) as Record<string, any>;
      token = query.token ? String(query.token) : null;
    }

    if (!token) return false;

    try {
      const decoded = verifyJwt(token, ENV.JWT_SECRET) as any;
      return decoded.igreja_id === igrejaId;
    } catch {
      return false;
    }
  }

  static async listarVitrine(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const chave = chavesCache.vitrine(req.user!.igreja_id);
      const emCache = await cacheGet<any>(chave);
      if (emCache) {
        res.setHeader('X-Cache', 'HIT');
        res.json(emCache);
        return;
      }
      const resposta = { total: 0, publicacoes: [] as any[] };
      const publicacoes = await MidiaService.listarVitrine(req.user as any);
      resposta.total = publicacoes.length;
      resposta.publicacoes = publicacoes as any;
      // TTL curto: vitrine sempre visível dentro de 1 minuto, com banco aliviado
      await cacheSet(chave, resposta, 60);
      res.setHeader('X-Cache', 'MISS');
      res.json(resposta);
    } catch (err: any) {
      res.status(err.statusCode || 400).json({ error: err.name || 'Erro', message: err.message });
    }
  }

  static async listarMinhas(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const conteudos = await MidiaService.listarMinhas(req.user as any);
      res.json({ total: conteudos.length, conteudos });
    } catch (err: any) {
      res.status(err.statusCode || 400).json({ error: err.name || 'Erro', message: err.message });
    }
  }

  static async listarPendentes(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const pendentes = await MidiaService.listarPendentes(req.user as any);
      res.json({ total: pendentes.length, pendentes });
    } catch (err: any) {
      res.status(err.statusCode || 403).json({ error: err.name || 'Erro', message: err.message });
    }
  }

  static async aprovar(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const aprovado = await MidiaService.aprovar(req.user as any, id);
      await cacheDel(chavesCache.vitrine(req.user!.igreja_id), chavesCache.vitrinePublica(req.user!.igreja_id));
      res.json({ message: 'Publicação aprovada pelo Pastor e liberada na vitrine!', conteudo: aprovado });
    } catch (err: any) {
      res.status(err.statusCode || 403).json({ error: err.name || 'Erro', message: err.message });
    }
  }

  static async devolver(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const devolvido = await MidiaService.devolver(req.user as any, id, req.body as DevolverMidiaInput);
      await cacheDel(chavesCache.vitrine(req.user!.igreja_id), chavesCache.vitrinePublica(req.user!.igreja_id));
      res.json({ message: 'Conteúdo devolvido à Mídia com comentário para correção.', conteudo: devolvido });
    } catch (err: any) {
      res.status(err.statusCode || 403).json({ error: err.name || 'Erro', message: err.message });
    }
  }

  static async excluirMidia(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await MidiaService.excluir(req.user as any, id);
      await cacheDel(chavesCache.vitrine(req.user!.igreja_id), chavesCache.vitrinePublica(req.user!.igreja_id));
      res.json({ message: 'Mídia excluída com sucesso.' });
    } catch (err: any) {
      res.status(err.statusCode || 400).json({ error: err.name || 'Erro', message: err.message });
    }
  }

  static async atualizarEReenviar(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const atualizado = await MidiaService.atualizarEReenviar(req.user as any, id, req.body as AtualizarMidiaInput);
      await cacheDel(chavesCache.vitrine(req.user!.igreja_id), chavesCache.vitrinePublica(req.user!.igreja_id));
      res.json({ message: 'Conteúdo corrigido e reenviado com sucesso.', conteudo: atualizado });
    } catch (err: any) {
      res.status(err.statusCode || 400).json({ error: err.name || 'Erro', message: err.message });
    }
  }

  // --- CALENDÁRIO ---
  static async criarEvento(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const evento = await CalendarioService.criar(req.user as any, req.body as CriarEventoInput);
      await cacheDel(chavesCache.vitrine(req.user!.igreja_id), chavesCache.vitrinePublica(req.user!.igreja_id));
      res.status(201).json({ message: 'Evento criado com sucesso no calendário.', evento });
    } catch (err: any) {
      res.status(err.statusCode || 400).json({ error: err.name || 'Erro', message: err.message });
    }
  }

  static async listarEventos(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const eventos = await CalendarioService.listar(req.user as any);
      res.json({ total: eventos.length, eventos });
    } catch (err: any) {
      res.status(err.statusCode || 400).json({ error: err.name || 'Erro', message: err.message });
    }
  }

  static async atualizarEvento(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const evento = await CalendarioService.atualizar(req.user as any, id, req.body as AtualizarEventoInput);
      await cacheDel(chavesCache.vitrine(req.user!.igreja_id), chavesCache.vitrinePublica(req.user!.igreja_id));
      res.json({ message: 'Evento atualizado.', evento });
    } catch (err: any) {
      res.status(err.statusCode || 400).json({ error: err.name || 'Erro', message: err.message });
    }
  }

  static async excluirEvento(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await CalendarioService.excluir(req.user as any, id);
      await cacheDel(chavesCache.vitrine(req.user!.igreja_id), chavesCache.vitrinePublica(req.user!.igreja_id));
      res.json({ message: 'Evento excluído do calendário com sucesso.' });
    } catch (err: any) {
      res.status(err.statusCode || 400).json({ error: err.name || 'Erro', message: err.message });
    }
  }

  // --- PERSONALIZAÇÃO VISUAL ---
  static async obterVisual(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const config = await VisualService.obter(req.user as any);
      res.json(config);
    } catch (err: any) {
      res.status(err.statusCode || 400).json({ error: err.name || 'Erro', message: err.message });
    }
  }

  static async atualizarVisual(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const atualizado = await VisualService.atualizar(req.user as any, req.body as PersonalizacaoVisualInput);
      await cacheDel(chavesCache.vitrine(req.user!.igreja_id), chavesCache.vitrinePublica(req.user!.igreja_id));
      res.json({ message: 'Identidade visual atualizada com sucesso.', configuracao: atualizado });
    } catch (err: any) {
      res.status(err.statusCode || 400).json({ error: err.name || 'Erro', message: err.message });
    }
  }
}

