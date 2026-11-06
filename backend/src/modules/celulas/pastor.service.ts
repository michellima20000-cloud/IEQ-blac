import { prisma } from '../../config/prisma.ts';
import { PermissaoError } from '../../permissions/rules.ts';
import type { UsuarioAutenticado } from '../../permissions/types.ts';
import type { FiltroDashboardPastorInput } from './celulas.schemas.ts';

export class PastorDashboardService {
  /**
   * Indicadores gerais da igreja para o painel do Pastor
   */
  static async obterIndicadores(usuario: UsuarioAutenticado, filtros: FiltroDashboardPastorInput) {
    if (usuario.perfil !== 'PASTOR') {
      throw new PermissaoError('Acesso restrito ao Pastor.');
    }

    const { redeId, dataInicio, dataFim } = filtros;
    const igreja_id = usuario.igreja_id;

    // Período padrão: últimos 30 dias se não informado
    const fim = dataFim ? new Date(dataFim) : new Date();
    const inicio = dataInicio ? new Date(dataInicio) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Filtro base para células
    const celulaWhere: any = {
      igreja_id,
      ...(redeId ? { redeId } : {})
    };

    // 1. Total de Células
    const totalCelulas = await prisma.celula.count({
      where: celulaWhere
    });

    // 2. Total de Membros Ativos
    const totalMembrosAtivos = await prisma.membro.count({
      where: {
        igreja_id,
        ativo: true,
        ...(redeId ? { celula: { redeId } } : {})
      }
    });

    // 3. Novos Visitantes no Período
    const novosVisitantes = await prisma.visitante.count({
      where: {
        igreja_id,
        dataPrimeiraVisita: {
          gte: inicio,
          lte: fim
        },
        ...(redeId ? { celula: { redeId } } : {})
      }
    });

    // 4. Relatórios do Período
    const relatorios = await prisma.relatorioCelula.findMany({
      where: {
        igreja_id,
        data: {
          gte: inicio,
          lte: fim
        },
        ...(redeId ? { celula: { redeId } } : {})
      },
      select: {
        presentes: true,
        visitantes: true,
        status: true
      }
    });

    const totalPresentes = relatorios.reduce((acc, cur) => acc + cur.presentes, 0);
    const mediaFrequencia = relatorios.length > 0
      ? Number((totalPresentes / relatorios.length).toFixed(1))
      : 0;

    return {
      periodo: {
        inicio: inicio.toISOString(),
        fim: fim.toISOString()
      },
      filtroRedeId: redeId || 'TODAS',
      indicadores: {
        totalCelulas,
        totalMembrosAtivos,
        novosVisitantes,
        totalRelatoriosEnviados: relatorios.length,
        totalPresentes,
        mediaFrequenciaPorReuniao: mediaFrequencia
      }
    };
  }
}

