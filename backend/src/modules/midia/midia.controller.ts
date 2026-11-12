import type { Response } from 'express';
import { MidiaService } from './midia.service.ts';
import { CalendarioService } from './calendario.service.ts';
import { VisualService } from './visual.service.ts';
import { criarMidiaSchema } from './midia.schemas.ts';
import { ImageProcessor } from '../../services/imageProcessor.ts';
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
      let nomeOriginal = '';
      let tamanhoArquivoBytes = 0;

      if (arquivos && arquivos.length > 0) {
        // Processa apenas o primeiro arquivo selecionado (para manter compatibilidade com o schema único de arquivoUrl)
        const arquivo = arquivos[0];
        const processed = await ImageProcessor.processToWebP(arquivo.buffer, {
          maxWidth: 1280,
          quality: 80
        });
        arquivoUrl = `data:${processed.mimeType};base64,${processed.buffer.toString('base64')}`;
        nomeOriginal = arquivo.originalname;
        tamanhoArquivoBytes = processed.buffer.length;
      }

      const dados: CriarMidiaInput = arquivos && arquivos.length > 0
        ? await criarMidiaSchema.parseAsync({
            tipo: req.body.tipo,
            titulo: req.body.titulo,
            descricao: req.body.descricao || null,
            videoUrl: req.body.videoUrl || null,
            precisaAprovacao: req.body.precisaAprovacao === 'true',
            tipoArquivo: arquivos?.[0]?.mimetype ?? '',
            nomeOriginal,
            arquivoUrl,
            tamanhoArquivoBytes
          })
        : await criarMidiaSchema.parseAsync(req.body);

      const conteudo = await MidiaService.criar(req.user as any, dados);
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

