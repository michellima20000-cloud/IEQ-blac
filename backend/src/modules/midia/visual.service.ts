import { prisma } from '../../config/prisma.ts';
import { PermissaoError } from '../../permissions/rules.ts';
import type { UsuarioAutenticado } from '../../permissions/types.ts';
import type { PersonalizacaoVisualInput } from './midia.schemas.ts';

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

    const config = await prisma.configuracaoIgreja.upsert({
      where: { igreja_id: usuario.igreja_id },
      update: {
        ...(dados.corPrimaria !== undefined ? { corPrimaria: dados.corPrimaria } : {}),
        ...(dados.corSecundaria !== undefined ? { corSecundaria: dados.corSecundaria } : {}),
        ...(dados.corFundo !== undefined ? { corFundo: dados.corFundo } : {}),
        ...(dados.logoUrl !== undefined ? { logoUrl: dados.logoUrl } : {}),
        ...(dados.layoutDivulgacao !== undefined ? { layoutDivulgacao: dados.layoutDivulgacao } : {})
      },
      create: {
        igreja_id: usuario.igreja_id,
        corPrimaria: dados.corPrimaria || CONFIG_VISUAL_PADRAO.corPrimaria,
        corSecundaria: dados.corSecundaria || CONFIG_VISUAL_PADRAO.corSecundaria,
        corFundo: dados.corFundo || CONFIG_VISUAL_PADRAO.corFundo,
        logoUrl: dados.logoUrl ?? null,
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
}

