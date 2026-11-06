import { Response } from 'express';
import { MidiaService } from './midia.service.ts';
import { CalendarioService } from './calendario.service.ts';
import { VisualService } from './visual.service.ts';
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
      const conteudo = await MidiaService.criar(req.user as any, req.body as CriarMidiaInput);
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
      const publicacoes = await MidiaService.listarVitrine(req.user as any);
      res.json({ total: publicacoes.length, publicacoes });
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
      res.json({ message: 'Publicação aprovada pelo Pastor e liberada na vitrine!', conteudo: aprovado });
    } catch (err: any) {
      res.status(err.statusCode || 403).json({ error: err.name || 'Erro', message: err.message });
    }
  }

  static async devolver(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const devolvido = await MidiaService.devolver(req.user as any, id, req.body as DevolverMidiaInput);
      res.json({ message: 'Conteúdo devolvido à Mídia com comentário para correção.', conteudo: devolvido });
    } catch (err: any) {
      res.status(err.statusCode || 403).json({ error: err.name || 'Erro', message: err.message });
    }
  }

  static async atualizarEReenviar(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const atualizado = await MidiaService.atualizarEReenviar(req.user as any, id, req.body as AtualizarMidiaInput);
      res.json({ message: 'Conteúdo corrigido e reenviado com sucesso.', conteudo: atualizado });
    } catch (err: any) {
      res.status(err.statusCode || 400).json({ error: err.name || 'Erro', message: err.message });
    }
  }

  // --- CALENDÁRIO ---
  static async criarEvento(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const evento = await CalendarioService.criar(req.user as any, req.body as CriarEventoInput);
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
      res.json({ message: 'Evento atualizado.', evento });
    } catch (err: any) {
      res.status(err.statusCode || 400).json({ error: err.name || 'Erro', message: err.message });
    }
  }

  static async excluirEvento(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await CalendarioService.excluir(req.user as any, id);
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
      res.json({ message: 'Identidade visual atualizada com sucesso.', configuracao: atualizado });
    } catch (err: any) {
      res.status(err.statusCode || 400).json({ error: err.name || 'Erro', message: err.message });
    }
  }
}
