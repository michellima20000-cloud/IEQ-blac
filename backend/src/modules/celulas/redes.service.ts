import { prisma } from '../../config/prisma.ts';
import { PermissaoError } from '../../permissions/rules.ts';
import { RelatoriosService } from './relatorios.service.ts';
import type { UsuarioAutenticado } from '../../permissions/types.ts';

export class RedesService {
  /**
   * Consolidado semanal da rede:
   * - Relatórios fechados com foto
   * - Totalizadores (presentes, visitantes)
   * - Células pendentes (não enviaram ou não fecharam relatório na semana)
   */
  static async obterConsolidadoRede(usuario: UsuarioAutenticado, redeId: string, dataReferencia?: Date) {
    // Validação de RBAC do Líder de Rede ou Pastor
    if (usuario.perfil === 'REDE' && usuario.redeId !== redeId) {
      throw new PermissaoError('Acesso negado: Líder de rede só pode acessar sua própria rede.');
    }

    if (usuario.perfil === 'CELULA' || usuario.perfil === 'MIDIA') {
      throw new PermissaoError('Acesso negado para este recurso.');
    }

    const rede = await prisma.rede.findUnique({
      where: { id: redeId, igreja_id: usuario.igreja_id },
      include: {
        celulas: true
      }
    });

    if (!rede) {
      throw new Error('Rede não encontrada nesta igreja.');
    }

    // Intervalo da semana (últimos 7 dias ou dataReferencia)
    const fim = dataReferencia ? new Date(dataReferencia) : new Date();
    const inicio = new Date(fim);
    inicio.setDate(inicio.getDate() - 7);

    // 1. Relatórios FECHADOS de todas as células da rede
    const relatoriosFechados = await prisma.relatorioCelula.findMany({
      where: {
        celula: { redeId },
        igreja_id: usuario.igreja_id,
        status: 'FECHADO',
        data: {
          gte: inicio,
          lte: fim
        }
      },
      include: {
        celula: { select: { id: true, nome: true } },
        lider: { select: { id: true, nome: true } }
      },
      orderBy: { data: 'desc' }
    });

    // Anexa a URL assinada para cada relatório que tem foto
    const relatoriosComUrlAssinada = relatoriosFechados.map((rel) => ({
      ...rel,
      fotoUrlAssinada: rel.fotoUrl ? RelatoriosService.gerarUrlAssinadaFoto(rel.id, rel.fotoUrl) : null
    }));

    // 2. Consolidado semanal da rede
    const totalPresentes = relatoriosFechados.reduce((acc, cur) => acc + cur.presentes, 0);
    const totalVisitantes = relatoriosFechados.reduce((acc, cur) => acc + cur.visitantes, 0);

    // 3. Células que NÃO enviaram ou não fecharam relatório na semana
    const celulasComRelatorioIds = new Set(relatoriosFechados.map((r) => r.celulaId));
    const celulasPendentes = rede.celulas.filter((c) => !celulasComRelatorioIds.has(c.id));

    return {
      rede: {
        id: rede.id,
        nome: rede.nome,
        totalCelulas: rede.celulas.length
      },
      periodo: {
        inicio: inicio.toISOString(),
        fim: fim.toISOString()
      },
      consolidado: {
        totalRelatoriosFechados: relatoriosFechados.length,
        totalPresentes,
        totalVisitantes,
        mediaPresentesPorCelula: relatoriosFechados.length > 0
          ? Number((totalPresentes / relatoriosFechados.length).toFixed(1))
          : 0
      },
      celulasPendentes: celulasPendentes.map((c) => ({
        id: c.id,
        nome: c.nome,
        diaSemana: c.diaSemana,
        horario: c.horario
      })),
      relatorios: relatoriosComUrlAssinada
    };
  }
}

