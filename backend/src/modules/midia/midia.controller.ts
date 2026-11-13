import type { Response } from 'express';
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
    try {
      // O multer.array('arquivos') pode retornar undefined (nenhum arquivo) ou um array de file objects
      // O multer pode entregar os arquivos como array (campo único) ou objeto
      // (vários campos aceitos). A normalização garante os dois formatos.
      const arquivos = normalizarArquivos((req as any).files);
      let arquivoUrl: string | null = null;
      let arquivoEnviado: ArquivoEnviado | null = null;
      let tamanhoArquivoBytes = 0;
      let arquivoEhVideo = false;

      if (arquivos && arquivos.length > 0) {
        // Processa apenas o primeiro arquivo selecionado (para manter compatibilidade com o schema único de arquivoUrl)
        const arquivo = arquivos[0];
        const mimeEnviado = String(arquivo.mimetype || '').toLowerCase();

        if (mimeEnviado.startsWith('video/')) {
          // VÍDEO: os bytes crus vão para o banco (nada de base64 no JSON).
          // Base64 de vídeo estourava a memória da API e derrubava o servidor
          // (upload acima de ~15 MB voltava com 502).
          const mimeReal = detectarMimeType(arquivo.buffer);
          const mimeType = mimeDeVideoValido(mimeReal) ? mimeReal : mimeEnviado;
          arquivoEnviado = {
            bytes: arquivo.buffer,
            mimeType,
            nomeOriginal: arquivo.originalname,
            tamanho: arquivo.buffer.length
          };
          tamanhoArquivoBytes = arquivo.buffer.length;
          arquivoEhVideo = true;
        } else {
          // IMAGEM: converte para WebP e guarda como data URL (comportamento antigo).
          const processed = await ImageProcessor.processToWebP(arquivo.buffer, {
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

      const conteudo = await MidiaService.criar(req.user as any, dados, arquivoEnviado);
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
    }
  }

  // --- ARQUIVO DO CONTEÚDO (VÍDEO/IMAGEM GRAVADOS NO BANCO) ---
  /**
   * Serve o arquivo do conteúdo (vídeo enviado pela equipe de Mídia).
   *
   * - Conteúdo PUBLICADO é público (é o que aparece na vitrine compartilhável).
   * - Os demais exigem um usuário autenticado da mesma igreja.
   * - Suporta Range para o navegador conseguir navegar/assistir o vídeo.
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
          arquivoBytes: true,
          arquivoMimeType: true,
          nomeOriginal: true
        }
      });

      if (!conteudo || !conteudo.arquivoBytes) {
        res.status(404).json({ error: 'NaoEncontrado', message: 'Arquivo não encontrado.' });
        return;
      }

      if (conteudo.status !== 'PUBLICADO' && !MidiaController.usuarioDaMesmaIgreja(req, conteudo.igreja_id)) {
        res.status(404).json({ error: 'NaoEncontrado', message: 'Arquivo não encontrado.' });
        return;
      }
      const bytes = Buffer.isBuffer(conteudo.arquivoBytes)
        ? conteudo.arquivoBytes
        : Buffer.from(conteudo.arquivoBytes as any);
      const total = bytes.length;

      res.setHeader('Content-Type', conteudo.arquivoMimeType || 'application/octet-stream');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader(
        'Cache-Control',
        conteudo.status === 'PUBLICADO' ? 'public, max-age=86400' : 'private, max-age=3600'
      );
      if (conteudo.nomeOriginal) {
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(conteudo.nomeOriginal)}"`);
      }

      const range = req.headers.range;
      const match = range ? /bytes=(\d*)-(\d*)/.exec(String(range)) : null;
      if (match) {
        let inicio = match[1] ? parseInt(match[1], 10) : 0;
        let fim = match[2] ? parseInt(match[2], 10) : total - 1;
        if (Number.isNaN(inicio) || inicio < 0) inicio = 0;
        if (Number.isNaN(fim) || fim >= total) fim = total - 1;

        if (inicio > fim || inicio >= total) {
          res.status(416).setHeader('Content-Range', `bytes */${total}`);
          res.end();
          return;
        }

        res.status(206);
        res.setHeader('Content-Range', `bytes ${inicio}-${fim}/${total}`);
        res.setHeader('Content-Length', String(fim - inicio + 1));
        res.end(bytes.subarray(inicio, fim + 1));
        return;
      }

      res.setHeader('Content-Length', String(total));
      res.end(bytes);
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

