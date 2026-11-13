import { prisma } from '../../config/prisma.ts';
import { PermissaoError } from '../../permissions/rules.ts';
import type { UsuarioAutenticado } from '../../permissions/types.ts';
import type { PersonalizacaoVisualInput } from './midia.schemas.ts';
import { caminhoLogoIgreja, extrairDataUrl } from '../../utils/upload.ts';

// Configuração padrão da identidade visual caso ainda não personalizada
const CONFIG_VISUAL_PADRAO = {
  corPrimaria: '#2563eb', // Azul real
  corSecundaria: '#f59e0b', // Dourado
  corFundo: '#0f172a', // Slate escuro
  logoUrl: null,
  layoutDivulgacao: 'GRID'
};

export class VisualService {
  /**
   * Obtém a identidade visual da igreja
   */
  static async obter(usuario: UsuarioAutenticado) {
    const config = await prisma.configuracaoIgreja.findUnique({
      where: { igreja_id: usuario.igreja_id }
    });

    return {
      igreja_id: usuario.igreja_id,
      visual: {
        corPrimaria: config?.corPrimaria || CONFIG_VISUAL_PADRAO.corPrimaria,
        corSecundaria: config?.corSecundaria || CONFIG_VISUAL_PADRAO.corSecundaria,
        corFundo: config?.corFundo || CONFIG_VISUAL_PADRAO.corFundo,
        logoUrl: config?.logoUrl ?? null,
        layoutDivulgacao: config?.layoutDivulgacao || CONFIG_VISUAL_PADRAO.layoutDivulgacao
      }
    };
  }

  /**
   * Obtém a identidade visual pelo slug da igreja (endpoint público, usado na tela de login)
   */
  static async obterPorSlug(slug: string) {
    const igreja = await prisma.igreja.findUnique({
      where: { slug },
      select: { id: true }
    });

    if (!igreja) {
      return null;
    }

    const config = await prisma.configuracaoIgreja.findUnique({
      where: { igreja_id: igreja.id }
    });

    return {
      corPrimaria: config?.corPrimaria || CONFIG_VISUAL_PADRAO.corPrimaria,
      corSecundaria: config?.corSecundaria || CONFIG_VISUAL_PADRAO.corSecundaria,
      corFundo: config?.corFundo || CONFIG_VISUAL_PADRAO.corFundo,
      logoUrl: config?.logoUrl ?? null,
      layoutDivulgacao: config?.layoutDivulgacao || CONFIG_VISUAL_PADRAO.layoutDivulgacao
    };
  }

  /**
   * Atualiza a personalização visual da igreja (Mídia ou Pastor)
   */
  static async atualizar(usuario: UsuarioAutenticado, dados: PersonalizacaoVisualInput) {
    if (usuario.perfil !== 'MIDIA' && usuario.perfil !== 'PASTOR') {
      throw new PermissaoError('Apenas Mídia e Pastor podem alterar a identidade visual da igreja.');
    }

    // O logo é gravado no banco como bytes (arquivos_igreja) e servido por
    // /logo/:igrejaId: nenhum arquivo fica embutido como base64 no texto.
    const logoUrl = await VisualService.salvarLogo(usuario.igreja_id, dados.logoUrl);

    const config = await prisma.configuracaoIgreja.upsert({
      where: { igreja_id: usuario.igreja_id },
      update: {
        ...(dados.corPrimaria !== undefined ? { corPrimaria: dados.corPrimaria } : {}),
        ...(dados.corSecundaria !== undefined ? { corSecundaria: dados.corSecundaria } : {}),
        ...(dados.corFundo !== undefined ? { corFundo: dados.corFundo } : {}),
        ...(logoUrl !== undefined ? { logoUrl } : {}),
        ...(dados.layoutDivulgacao !== undefined ? { layoutDivulgacao: dados.layoutDivulgacao } : {})
      },
      create: {
        igreja_id: usuario.igreja_id,
        corPrimaria: dados.corPrimaria || CONFIG_VISUAL_PADRAO.corPrimaria,
        corSecundaria: dados.corSecundaria || CONFIG_VISUAL_PADRAO.corSecundaria,
        corFundo: dados.corFundo || CONFIG_VISUAL_PADRAO.corFundo,
        logoUrl: logoUrl ?? null,
        layoutDivulgacao: dados.layoutDivulgacao || CONFIG_VISUAL_PADRAO.layoutDivulgacao
      }
    });

    return {
      igreja_id: usuario.igreja_id,
      visual: {
        corPrimaria: config.corPrimaria,
        corSecundaria: config.corSecundaria,
        corFundo: config.corFundo,
        logoUrl: config.logoUrl,
        layoutDivulgacao: config.layoutDivulgacao
      },
      atualizadoPor: usuario.id || (usuario as any).sub,
      atualizadoEm: new Date().toISOString()
    };
  }

  /**
   * Prazo de retenção das fotos dos relatórios (configurado pelo Pastor).
   * É este prazo que o job de limpeza usa para apagar as fotos vencidas.
   */
  static async obterRetencao(usuario: UsuarioAutenticado) {
    const config = await prisma.configuracaoIgreja.findUnique({
      where: { igreja_id: usuario.igreja_id },
      select: { prazoRetencaoFotosDias: true }
    });

    return {
      igreja_id: usuario.igreja_id,
      prazoRetencaoFotosDias: config?.prazoRetencaoFotosDias ?? 60
    };
  }

  /**
   * Atualiza o prazo de retenção das fotos dos relatórios.
   * Só Pastor (ou ADM) altera essa política.
   */
  static async atualizarRetencao(usuario: UsuarioAutenticado, prazoRetencaoFotosDias: number) {
    if (usuario.perfil !== 'PASTOR' && usuario.perfil !== 'ADM') {
      throw new PermissaoError('Apenas o Pastor pode alterar o prazo de retenção das fotos.');
    }

    const prazo = Math.min(Math.max(Math.round(prazoRetencaoFotosDias), 1), 365);

    const config = await prisma.configuracaoIgreja.upsert({
      where: { igreja_id: usuario.igreja_id },
      update: { prazoRetencaoFotosDias: prazo },
      create: { igreja_id: usuario.igreja_id, prazoRetencaoFotosDias: prazo },
      select: { prazoRetencaoFotosDias: true }
    });

    return {
      igreja_id: usuario.igreja_id,
      prazoRetencaoFotosDias: config.prazoRetencaoFotosDias,
      atualizadoEm: new Date().toISOString()
    };
  }

  /**
   * Grava (ou apaga) o logo da igreja.
   * - Recebe uma data URL (upload do painel) -> vira bytes no banco e
   *   devolve o caminho "/logo/:igrejaId".
   * - Recebe null -> apaga o arquivo.
   * - Recebe uma URL externa (http/https) -> mantém como está.
   */
  static async salvarLogo(igrejaId: string, logoUrl?: string | null): Promise<string | null | undefined> {
    if (logoUrl === undefined) return undefined;

    if (logoUrl === null || logoUrl === '') {
      await prisma.arquivoIgreja.deleteMany({ where: { igreja_id: igrejaId } });
      return null;
    }

    const extraido = extrairDataUrl(logoUrl);
    if (!extraido) return logoUrl; // URL externa: mantém como está

    await prisma.arquivoIgreja.upsert({
      where: { igreja_id: igrejaId },
      update: {
        mimeType: extraido.mimeType,
        bytes: extraido.bytes,
        tamanho: extraido.bytes.length
      },
      create: {
        igreja_id: igrejaId,
        mimeType: extraido.mimeType,
        bytes: extraido.bytes,
        tamanho: extraido.bytes.length
      }
    });

    return caminhoLogoIgreja(igrejaId);
  }

  /**
   * Migração dos logos antigos: logos guardados como texto base64 dentro de
   * configuracao_igrejas.logoUrl passam a ficar gravados como bytes.
   */
  static async migrarLogosLegados(): Promise<number> {
    const legados = await prisma.configuracaoIgreja.findMany({
      where: { logoUrl: { startsWith: 'data:' } },
      select: { igreja_id: true, logoUrl: true }
    });

    let migrados = 0;
    for (const config of legados) {
      const extraido = extrairDataUrl(config.logoUrl || '');
      if (!extraido) continue;

      await prisma.arquivoIgreja.upsert({
        where: { igreja_id: config.igreja_id },
        update: {
          mimeType: extraido.mimeType,
          bytes: extraido.bytes,
          tamanho: extraido.bytes.length
        },
        create: {
          igreja_id: config.igreja_id,
          mimeType: extraido.mimeType,
          bytes: extraido.bytes,
          tamanho: extraido.bytes.length
        }
      });

      await prisma.configuracaoIgreja.update({
        where: { igreja_id: config.igreja_id },
        data: { logoUrl: caminhoLogoIgreja(config.igreja_id) }
      });
      migrados++;
    }

    return migrados;
  }
}

