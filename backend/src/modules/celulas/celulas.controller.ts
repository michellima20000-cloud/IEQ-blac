import { Response } from 'express';
import { CelulasService } from './celulas.service.ts';
import { RelatoriosService } from './relatorios.service.ts';
import { RedesService } from './redes.service.ts';
import { PastorDashboardService } from './pastor.service.ts';
import type { AuthenticatedRequest } from '../../middlewares/auth.ts';
import type {
  CriarMembroInput,
  AtualizarMembroInput,
  CriarVisitanteInput,
  CriarRelatorioInput,
  AtualizarRelatorioInput
} from './celulas.schemas.ts';

export class CelulasController {
  static async obterMinhaCelula(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const celula = await CelulasService.obterOuVincularMinhaCelula(req.user as any);
      res.json({ celula });
    } catch (err: any) {
      res.status(err.statusCode || 400).json({ error: err.name || 'Erro', message: err.message });
    }
  }

  static async listarTodasCelulas(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const celulas = await CelulasService.listarTodas(req.igreja_id!);
      res.json({ celulas });
    } catch (err: any) {
      res.status(err.statusCode || 400).json({ error: err.name || 'Erro', message: err.message });
    }
  }

  static async listarTodasRedes(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { prisma } = await import('../../config/prisma.ts');
      const redes = await prisma.rede.findMany({
        where: { igreja_id: req.igreja_id! },
        include: { _count: { select: { celulas: true, lideres: true } } },
        orderBy: { nome: 'asc' }
      });
      res.json({ redes });
    } catch (err: any) {
      res.status(err.statusCode || 400).json({ error: err.name || 'Erro', message: err.message });
    }
  }

  static async obterMinhaRede(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      let redeId = req.user?.redeId;
      if (!redeId) {
        const { prisma } = await import('../../config/prisma.ts');
        let rede = await prisma.rede.findFirst({ where: { igreja_id: req.igreja_id! } });
        if (!rede) {
          rede = await prisma.rede.create({
            data: { nome: 'Rede Central', igreja_id: req.igreja_id! }
          });
        }
        redeId = rede.id;
        await prisma.usuario.update({
          where: { id: req.user!.sub },
          data: { redeId }
        });
      }
      const consolidado = await RedesService.obterConsolidadoRede(req.user as any, redeId);
      res.json(consolidado);
    } catch (err: any) {
      res.status(err.statusCode || 400).json({ error: err.name || 'Erro', message: err.message });
    }
  }

  // --- MEMBROS ---
  static async criarMembro(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { celulaId } = req.params;
      const membro = await CelulasService.criarMembro(req.user as any, celulaId, req.body as CriarMembroInput);
      res.status(201).json({ message: 'Membro cadastrado com sucesso', membro });
    } catch (err: any) {
      res.status(err.statusCode || 400).json({ error: err.name || 'Erro', message: err.message });
    }
  }

  static async atualizarMembro(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { celulaId, id } = req.params;
      const membro = await CelulasService.atualizarMembro(req.user as any, celulaId, id, req.body as AtualizarMembroInput);
      res.json({ message: 'Membro atualizado com sucesso', membro });
    } catch (err: any) {
      res.status(err.statusCode || 400).json({ error: err.name || 'Erro', message: err.message });
    }
  }

  static async listarMembros(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { celulaId } = req.params;
      const membros = await CelulasService.listarMembros(req.user as any, celulaId);
      res.json({ total: membros.length, membros });
    } catch (err: any) {
      res.status(err.statusCode || 400).json({ error: err.name || 'Erro', message: err.message });
    }
  }

  // --- VISITANTES ---
  static async criarVisitante(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { celulaId } = req.params;
      const visitante = await CelulasService.criarVisitante(req.user as any, celulaId, req.body as CriarVisitanteInput);
      res.status(201).json({ message: 'Visitante cadastrado com sucesso', visitante });
    } catch (err: any) {
      res.status(err.statusCode || 400).json({ error: err.name || 'Erro', message: err.message });
    }
  }

  static async listarVisitantes(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { celulaId } = req.params;
      const visitantes = await CelulasService.listarVisitantes(req.user as any, celulaId);
      res.json({ total: visitantes.length, visitantes });
    } catch (err: any) {
      res.status(err.statusCode || 400).json({ error: err.name || 'Erro', message: err.message });
    }
  }

  // --- RELATÓRIOS ---
  static async criarRelatorio(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { celulaId } = req.params;
      const relatorio = await RelatoriosService.criar(req.user as any, celulaId, req.body as CriarRelatorioInput);
      res.status(201).json({ message: 'Relatório semanal criado com sucesso', relatorio });
    } catch (err: any) {
      res.status(err.statusCode || 400).json({ error: err.name || 'Erro', message: err.message });
    }
  }

  static async atualizarRelatorio(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const relatorio = await RelatoriosService.atualizar(req.user as any, id, req.body as AtualizarRelatorioInput);
      res.json({ message: 'Relatório atualizado com sucesso', relatorio });
    } catch (err: any) {
      res.status(err.statusCode || 400).json({ error: err.name || 'Erro', message: err.message });
    }
  }

  static async fecharRelatorio(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const relatorio = await RelatoriosService.fechar(req.user as any, id);
      res.json({ message: 'Relatório fechado com sucesso. Não pode mais ser editado.', relatorio });
    } catch (err: any) {
      res.status(err.statusCode || 400).json({ error: err.name || 'Erro', message: err.message });
    }
  }

  static async visualizarFoto(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        res.status(400).json({ error: 'Token de assinatura obrigatório na query string.' });
        return;
      }

      const fotoUrl = await RelatoriosService.registrarAcessoFoto(req.user as any, id, token, req.ip);
      res.json({
        message: 'Acesso autorizado à foto e registrado na auditoria.',
        fotoUrl
      });
    } catch (err: any) {
      res.status(err.statusCode || 403).json({ error: err.name || 'Erro', message: err.message });
    }
  }

  static async excluirRelatorio(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const relatorio = await RelatoriosService.excluir(req.user as any, id);
      res.json({ message: 'Relatório excluído com sucesso', relatorio });
    } catch (err: any) {
      res.status(err.statusCode || 403).json({ error: err.name || 'Erro', message: err.message });
    }
  }

  // --- REDE (LÍDER DE REDE) ---
  static async consolidadoRede(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { redeId } = req.params;
      const { dataReferencia } = req.query;
      const dados = await RedesService.obterConsolidadoRede(
        req.user as any,
        redeId,
        dataReferencia ? new Date(dataReferencia as string) : undefined
      );
      res.json(dados);
    } catch (err: any) {
      res.status(err.statusCode || 400).json({ error: err.name || 'Erro', message: err.message });
    }
  }

  // --- DETALHES DOS INDICADORES DA REDE (listas reais) ---
  static async detalhesRede(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { redeId } = req.params;
      const dados = await RedesService.obterDetalhesRede(
        req.user as any,
        redeId,
        String((req.query as any).tipo || '')
      );
      res.json(dados);
    } catch (err: any) {
      res.status(err.statusCode || 400).json({ error: err.name || 'Erro', message: err.message });
    }
  }

  // --- DASHBOARD PASTOR ---
  static async dashboardPastor(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const filtros = req.query as any;
      const dados = await PastorDashboardService.obterIndicadores(req.user as any, filtros);
      res.json(dados);
    } catch (err: any) {
      res.status(err.statusCode || 400).json({ error: err.name || 'Erro', message: err.message });
    }
  }

  // --- DETALHES DOS INDICADORES DO PAINEL (listas reais) ---
  static async dashboardPastorDetalhes(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const filtros = req.query as any;
      const dados = await PastorDashboardService.obterDetalhesIndicador(
        req.user as any,
        String(filtros.tipo || ''),
        filtros
      );
      res.json(dados);
    } catch (err: any) {
      res.status(err.statusCode || 400).json({ error: err.name || 'Erro', message: err.message });
    }
  }
}

