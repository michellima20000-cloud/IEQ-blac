import { prisma } from '../config/prisma.ts';
import { StorageService } from './storage.service.ts';

export interface RelatorioItemLimpeza {
  id: string;
  igreja_id: string;
  data: Date;
  fotoUrl: string | null;
  manterFoto: boolean;
  presentes: number;
  visitantes: number;
  observacoes: string | null;
  status: string;
}

export class CleanupService {
  /**
   * Executa a limpeza diária de fotos de relatórios vencidas:
   * 1. Consulta prazo da igreja (default 60 dias)
   * 2. Remove fotos vencidas onde manterFoto === false do MinIO local e Nuvem
   * 3. Preserva 100% dos dados numéricos e observações do relatório
   * 4. Registra no LogAuditoria
   */
  static async executarLimpezaFotosVencidas(igreja_id: string, relatoriosMock?: RelatorioItemLimpeza[]) {
    // 1. Obtém o prazo configurado pelo pastor (default 60 dias)
    const config = await prisma.configuracaoIgreja.findUnique({
      where: { igreja_id }
    });
    const prazoDias = config?.prazoRetencaoFotosDias || 60;

    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - prazoDias);

    // 2. Busca relatórios com foto que venceram o prazo
    let relatoriosParaLimpar: RelatorioItemLimpeza[];
    if (relatoriosMock) {
      relatoriosParaLimpar = relatoriosMock.filter(
        (r) => r.igreja_id === igreja_id && r.fotoUrl && r.data < dataLimite
      );
    } else {
      relatoriosParaLimpar = await prisma.relatorioCelula.findMany({
        where: {
          igreja_id,
          fotoUrl: { not: null },
          data: { lt: dataLimite }
        }
      });
    }

    let totalFotosApagadas = 0;
    let totalFotosPreservadas = 0;

    for (const relatorio of relatoriosParaLimpar) {
      // REGRA MANDATÓRIA: Se estiver marcado para manter a foto, PRESERVA!
      if (relatorio.manterFoto) {
        totalFotosPreservadas++;
        continue;
      }

      if (relatorio.fotoUrl) {
        // Exclui do MinIO local e da Nuvem
        const key = relatorio.fotoUrl.replace(/^minio:\/\/[^\/]+\//, '');
        await StorageService.excluir(key);

        // Atualiza o relatório no banco: a foto é limpa, os dados continuam intactos
        if (!relatoriosMock) {
          await prisma.relatorioCelula.update({
            where: { id: relatorio.id },
            data: {
              fotoUrl: null,
              observacoes: relatorio.observacoes
                ? `${relatorio.observacoes} [Foto removida após o período de retenção]`
                : '[Foto removida após o período de retenção]'
            }
          });

          // Registra no LogAuditoria sem guardar o conteúdo
          await prisma.logAuditoria.create({
            data: {
              igreja_id,
              acao: 'LIMPEZA_AUTOMATICA_FOTO',
              recurso: `RelatorioCelula:${relatorio.id}`,
              detalhesJson: JSON.stringify({
                relatorioId: relatorio.id,
                motivo: `Prazo de retenção de ${prazoDias} dias expirado`,
                dataReuniao: relatorio.data.toISOString()
              })
            }
          });
        } else {
          // No mock para testes
          relatorio.fotoUrl = null;
        }

        totalFotosApagadas++;
      }
    }

    return {
      prazoDiasAplicado: prazoDias,
      dataLimiteCorte: dataLimite.toISOString(),
      totalFotosApagadas,
      totalFotosPreservadas
    };
  }

  /**
   * Identifica relatórios que vencerão nos próximos 7 dias para aviso prévio ao Pastor e Líder de Rede
   */
  static async identificarFotosPrestesAVencer(igreja_id: string, relatoriosMock?: RelatorioItemLimpeza[]) {
    const config = await prisma.configuracaoIgreja.findUnique({
      where: { igreja_id }
    });
    const prazoDias = config?.prazoRetencaoFotosDias || 60;

    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - prazoDias);

    const dataAvisoPrevio = new Date(dataLimite);
    dataAvisoPrevio.setDate(dataAvisoPrevio.getDate() + 7); // 7 dias antes

    let candidatos: RelatorioItemLimpeza[];
    if (relatoriosMock) {
      candidatos = relatoriosMock.filter(
        (r) => r.igreja_id === igreja_id && r.fotoUrl && r.data >= dataLimite && r.data <= dataAvisoPrevio
      );
    } else {
      candidatos = await prisma.relatorioCelula.findMany({
        where: {
          igreja_id,
          fotoUrl: { not: null },
          data: {
            gte: dataLimite,
            lte: dataAvisoPrevio
          }
        }
      });
    }

    return candidatos.map((c) => ({
      relatorioId: c.id,
      dataReuniao: c.data.toISOString(),
      manterFoto: c.manterFoto,
      diasRestantes: Math.ceil((c.data.getTime() - dataLimite.getTime()) / (1000 * 60 * 60 * 24)),
      mensagemAviso: 'Foto expira em breve. Baixe a imagem ou marque "manter esta foto" para preservá-la.'
    }));
  }

  /**
   * Métricas de armazenamento para o painel do Pastor:
   * - Espaço total usado
   * - Espaço estimado a ser liberado na próxima limpeza
   */
  static async calcularMetricasArmazenamento(igreja_id: string) {
    const espacoUsadoBytes = await StorageService.obterEspacoUtilizado();

    const config = await prisma.configuracaoIgreja.findUnique({
      where: { igreja_id }
    });
    const prazoDias = config?.prazoRetencaoFotosDias || 60;

    // Estimativa de 800 KB por foto de celular comprimida em WebP
    const TAMANHO_MEDIO_FOTO_BYTES = 800 * 1024;

    const fotosVencidasCount = await prisma.relatorioCelula.count({
      where: {
        igreja_id,
        fotoUrl: { not: null },
        manterFoto: false,
        data: {
          lt: new Date(Date.now() - prazoDias * 24 * 60 * 60 * 1000)
        }
      }
    });

    const espacoALiberarEstimadoBytes = fotosVencidasCount * TAMANHO_MEDIO_FOTO_BYTES;

    return {
      espacoUsadoBytes,
      espacoUsadoFormatado: `${(espacoUsadoBytes / (1024 * 1024)).toFixed(2)} MB`,
      espacoALiberarEstimadoBytes,
      espacoALiberarFormatado: `${(espacoALiberarEstimadoBytes / (1024 * 1024)).toFixed(2)} MB`,
      fotosVencidasAgendadas: fotosVencidasCount,
      prazoRetencaoConfiguradoDias: prazoDias
    };
  }
}

