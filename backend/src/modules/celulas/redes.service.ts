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
    // A foto (base64 de vários MB) NÃO vem na resposta: o front recebe uma
    // URL assinada e busca a imagem sob demanda.
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
      select: {
        id: true,
        data: true,
        presentes: true,
        visitantes: true,
        observacoes: true,
        status: true,
        fotoUrl: true,
        celula: { select: { id: true, nome: true } },
        lider: { select: { id: true, nome: true } }
      },
      orderBy: { data: 'desc' }
    });

    // Anexa a URL assinada para cada relatório que tem foto
    const relatoriosComUrlAssinada = relatoriosFechados.map(({ fotoUrl, ...rel }: any) => ({
      ...rel,
      temFoto: !!fotoUrl,
      fotoUrlAssinada: fotoUrl ? RelatoriosService.gerarUrlAssinadaFoto(rel.id) : null
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

  /**
   * Listas reais por trás de cada indicador da rede:
   * - celulas:    células da rede com líder(es), horário e nº de membros ativos
   * - relatorios: relatórios fechados da semana (base de presentes/visitantes)
   */
  static async obterDetalhesRede(usuario: UsuarioAutenticado, redeId: string, tipo: string) {
    if (usuario.perfil === 'REDE' && usuario.redeId !== redeId) {
      throw new PermissaoError('Acesso negado: Líder de rede só pode acessar sua própria rede.');
    }

    if (usuario.perfil === 'CELULA' || usuario.perfil === 'MIDIA') {
      throw new PermissaoError('Acesso negado para este recurso.');
    }

    const rede = await prisma.rede.findUnique({
      where: { id: redeId, igreja_id: usuario.igreja_id }
    });

    if (!rede) {
      throw new Error('Rede não encontrada nesta igreja.');
    }

    if (tipo === 'celulas') {
      const celulas = await prisma.celula.findMany({
        where: { igreja_id: usuario.igreja_id, redeId },
        select: {
          id: true,
          nome: true,
          diaSemana: true,
          horario: true,
          endereco: true,
          lideres: { select: { id: true, nome: true, email: true } },
          _count: { select: { membros: { where: { ativo: true } }, visitantes: true } }
        },
        orderBy: { nome: 'asc' }
      });
      return {
        tipo,
        itens: celulas.map((c: any) => ({
          id: c.id,
          nome: c.nome,
          diaSemana: c.diaSemana,
          horario: c.horario,
          endereco: c.endereco,
          lideres: c.lideres.map((l: any) => l.nome),
          membrosAtivos: c._count.membros,
          visitantes: c._count.visitantes
        }))
      };
    }

    if (tipo === 'relatorios') {
      const fim = new Date();
      const inicio = new Date(fim);
      inicio.setDate(inicio.getDate() - 7);

      const relatoriosFechados = await prisma.relatorioCelula.findMany({
        where: {
          celula: { redeId },
          igreja_id: usuario.igreja_id,
          status: 'FECHADO',
          data: { gte: inicio, lte: fim }
        },
        select: {
          id: true,
          data: true,
          presentes: true,
          visitantes: true,
          status: true,
          celula: { select: { nome: true } },
          lider: { select: { nome: true } }
        },
        orderBy: { data: 'desc' }
      });

      const totalPresentes = relatoriosFechados.reduce((acc: number, r: any) => acc + r.presentes, 0);
      const totalVisitantes = relatoriosFechados.reduce((acc: number, r: any) => acc + r.visitantes, 0);

      return {
        tipo,
        periodo: { inicio: inicio.toISOString(), fim: fim.toISOString() },
        resumo: {
          totalRelatorios: relatoriosFechados.length,
          totalPresentes,
          totalVisitantes
        },
        itens: relatoriosFechados.map((r: any) => ({
          id: r.id,
          data: r.data,
          presentes: r.presentes,
          visitantes: r.visitantes,
          status: r.status,
          celula: r.celula?.nome || null,
          lider: r.lider?.nome || null
        }))
      };
    }

    throw new PermissaoError('Tipo de detalhe inválido.');
  }
}

