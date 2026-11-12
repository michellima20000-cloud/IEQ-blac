import { prisma } from '../../config/prisma.ts';
import { candidatosSlug } from '../../utils/slug.ts';

/**
 * Filtro de conteúdo público: somente o que está PUBLICADO.
 * Exportado para permitir teste de regra sem depender de banco.
 */
export function wherePublicacoesPublicadas(igrejaId: string) {
  return { igreja_id: igrejaId, status: 'PUBLICADO' as const };
}

/**
 * Filtro de agenda pública: somente eventos que ainda vão acontecer.
 * Exportado para permitir teste de regra sem depender de banco.
 */
export function whereEventosPublicos(igrejaId: string, agora: Date = new Date()) {
  return { igreja_id: igrejaId, dataInicio: { gte: agora } };
}

/**
 * Vitrine pública da igreja (sem autenticação).
 *
 * REGRAS MANDATÓRIAS:
 * - Só entra conteúdo com status PUBLICADO (nada pendente, rascunho ou devolvido).
 * - Nada de dados de células, membros, visitantes ou relatórios (regra do projeto).
 * - A busca da igreja é feita pelo slug, aceitando variações de escrita/caixa/espaços.
 */
export class VitrinePublicaService {
  /** Localiza a igreja pelo slug informado (tolerante a "IEQ Cidade Nova", "ieq_cidade_nova"...) */
  static async buscarIgreja(slugInformado: string) {
    for (const candidato of candidatosSlug(slugInformado)) {
      const igreja = await prisma.igreja.findUnique({
        where: { slug: candidato },
        select: { id: true, nome: true, slug: true, ativa: true }
      });
      if (igreja) return igreja;
    }
    return null;
  }

  /** Conteúdos publicados (vitrine) da igreja. */
  static async listarPublicacoes(igrejaId: string, limite = 60) {
    return prisma.conteudoMidia.findMany({
      where: wherePublicacoesPublicadas(igrejaId),
      select: {
        id: true,
        tipo: true,
        titulo: true,
        descricao: true,
        arquivoUrl: true,
        videoUrl: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: limite
    });
  }

  /**
   * Agenda pública: prioriza os próximos eventos.
   * Se não houver evento futuro, mostra os mais recentes (histórico da igreja).
   */
  static async listarEventos(igrejaId: string, limite = 12) {
    const agora = new Date();
    const proximos = await prisma.eventoCalendario.findMany({
      where: whereEventosPublicos(igrejaId, agora),
      select: {
        id: true,
        titulo: true,
        descricao: true,
        dataInicio: true,
        dataFim: true,
        local: true
      },
      orderBy: { dataInicio: 'asc' },
      take: limite
    });

    if (proximos.length > 0) return proximos;

    return prisma.eventoCalendario.findMany({
      where: { igreja_id: igrejaId },
      select: {
        id: true,
        titulo: true,
        descricao: true,
        dataInicio: true,
        dataFim: true,
        local: true
      },
      orderBy: { dataInicio: 'desc' },
      take: limite
    });
  }
}
