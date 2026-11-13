import { prisma } from '../../config/prisma.ts';
import { PermissaoError } from '../../permissions/rules.ts';
import { BackupService } from '../../services/backup.service.ts';
import { CleanupService } from '../../services/cleanup.service.ts';
import { RelatoriosService } from './relatorios.service.ts';
import type { UsuarioAutenticado } from '../../permissions/types.ts';
import type { FiltroDashboardPastorInput } from './celulas.schemas.ts';

export class PastorDashboardService {
  /**
   * Indicadores gerais da igreja para o painel do Pastor:
   * - Métricas de células, membros, visitantes e frequência
   * - Alerta de backup > 48h
   * - Espaço em disco usado e estimativa a liberar na limpeza
   */
  static async obterIndicadores(usuario: UsuarioAutenticado, filtros: FiltroDashboardPastorInput) {
    if (usuario.perfil !== 'PASTOR' && usuario.perfil !== 'ADM') {
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

    // 5. Status do Backup (Alerta crítico se > 48h)
    const statusBackup = BackupService.verificarStatusBackupParaPastor();

    // 6. Métricas de Armazenamento e Limpeza Automática
    const armazenamento = await CleanupService.calcularMetricasArmazenamento(igreja_id);

    // 7. Lista detalhada de relatórios com célula, rede, líder e foto
    // A foto NÃO vem junto: ela é um base64 de vários MB e envio isso no
    // painel deixava a resposta gigas. O front recebe uma URL assinada e
    // busca a foto sob demanda (igual à tela de Rede).
    const relatoriosDetalhados = await prisma.relatorioCelula.findMany({
      where: {
        igreja_id,
        ...(redeId ? { celula: { redeId } } : {})
      },
      select: {
        id: true,
        data: true,
        presentes: true,
        visitantes: true,
        observacoes: true,
        status: true,
        dataFechamento: true,
        // Usado só para saber se existe foto (o base64 em si NÃO vai na resposta)
        fotoUrl: true,
        celula: {
          select: {
            id: true,
            nome: true,
            diaSemana: true,
            horario: true,
            rede: { select: { id: true, nome: true } }
          }
        },
        lider: {
          select: {
            id: true,
            nome: true,
            email: true
          }
        }
      },
      orderBy: { data: 'desc' },
      take: 50
    });

    const relatoriosComUrl = relatoriosDetalhados.map(({ fotoUrl, ...rel }: any) => ({
      ...rel,
      temFoto: !!fotoUrl,
      fotoUrlAssinada: fotoUrl ? RelatoriosService.gerarUrlAssinadaFoto(rel.id) : null
    }));

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
      },
      segurancaBackup: statusBackup,
      armazenamento,
      relatorios: relatoriosComUrl
    };
  }

  /**
   * Listas reais por trás de cada indicador do painel do Pastor:
   * - celulas:     células com rede, líder(es) e nº de membros ativos
   * - membros:     membros ativos com a célula de origem
   * - visitantes:  visitantes do período com célula e data da 1ª visita
   * - frequencia:  relatórios do período que compõem a média de frequência
   */
  static async obterDetalhesIndicador(
    usuario: UsuarioAutenticado,
    tipo: string,
    filtros: FiltroDashboardPastorInput
  ) {
    if (usuario.perfil !== 'PASTOR' && usuario.perfil !== 'ADM') {
      throw new PermissaoError('Acesso restrito ao Pastor.');
    }

    const { redeId, dataInicio, dataFim } = filtros;
    const igreja_id = usuario.igreja_id;

    const fim = dataFim ? new Date(dataFim) : new Date();
    const inicio = dataInicio ? new Date(dataInicio) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const filtroRede = redeId ? { redeId } : {};

    switch (tipo) {
      case 'celulas': {
        const celulas = await prisma.celula.findMany({
          where: { igreja_id, ...filtroRede },
          select: {
            id: true,
            nome: true,
            diaSemana: true,
            horario: true,
            endereco: true,
            rede: { select: { nome: true } },
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
            rede: c.rede?.nome || null,
            lideres: c.lideres.map((l: any) => l.nome),
            membrosAtivos: c._count.membros,
            visitantes: c._count.visitantes
          }))
        };
      }

      case 'membros': {
        const membros = await prisma.membro.findMany({
          where: { igreja_id, ativo: true, ...(redeId ? { celula: { redeId } } : {}) },
          select: {
            id: true,
            nome: true,
            telefone: true,
            dataNascimento: true,
            celula: {
              select: { nome: true, rede: { select: { nome: true } } }
            }
          },
          orderBy: { nome: 'asc' },
          take: 300
        });
        return {
          tipo,
          itens: membros.map((m: any) => ({
            id: m.id,
            nome: m.nome,
            telefone: m.telefone || null,
            celula: m.celula?.nome || null,
            rede: m.celula?.rede?.nome || null
          }))
        };
      }

      case 'visitantes': {
        const visitantes = await prisma.visitante.findMany({
          where: {
            igreja_id,
            dataPrimeiraVisita: { gte: inicio, lte: fim },
            ...(redeId ? { celula: { redeId } } : {})
          },
          select: {
            id: true,
            nome: true,
            telefone: true,
            dataPrimeiraVisita: true,
            celula: {
              select: { nome: true, rede: { select: { nome: true } } }
            }
          },
          orderBy: { dataPrimeiraVisita: 'desc' },
          take: 300
        });
        return {
          tipo,
          periodo: { inicio: inicio.toISOString(), fim: fim.toISOString() },
          itens: visitantes.map((v: any) => ({
            id: v.id,
            nome: v.nome,
            telefone: v.telefone || null,
            primeiraVisita: v.dataPrimeiraVisita,
            celula: v.celula?.nome || null,
            rede: v.celula?.rede?.nome || null
          }))
        };
      }

      case 'frequencia': {
        const relatorios = await prisma.relatorioCelula.findMany({
          where: {
            igreja_id,
            data: { gte: inicio, lte: fim },
            ...(redeId ? { celula: { redeId } } : {})
          },
          select: {
            id: true,
            data: true,
            presentes: true,
            visitantes: true,
            status: true,
            celula: { select: { nome: true, rede: { select: { nome: true } } } },
            lider: { select: { nome: true } }
          },
          orderBy: { data: 'desc' },
          take: 300
        });
        const totalPresentes = relatorios.reduce((acc: number, r: any) => acc + r.presentes, 0);
        return {
          tipo,
          periodo: { inicio: inicio.toISOString(), fim: fim.toISOString() },
          resumo: {
            totalRelatorios: relatorios.length,
            totalPresentes,
            mediaPorReuniao: relatorios.length > 0
              ? Number((totalPresentes / relatorios.length).toFixed(1))
              : 0
          },
          itens: relatorios.map((r: any) => ({
            id: r.id,
            data: r.data,
            presentes: r.presentes,
            visitantes: r.visitantes,
            status: r.status,
            celula: r.celula?.nome || null,
            rede: r.celula?.rede?.nome || null,
            lider: r.lider?.nome || null
          }))
        };
      }

      default:
        throw new PermissaoError('Tipo de detalhe inválido.');
    }
  }
}

