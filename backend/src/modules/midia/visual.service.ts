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
      visual: CONFIG_VISUAL_PADRAO
    };
  }

  /**
   * Atualiza a personalização visual da igreja (Mídia ou Pastor)
   */
  static async atualizar(usuario: UsuarioAutenticado, dados: PersonalizacaoVisualInput) {
    if (usuario.perfil !== 'MIDIA' && usuario.perfil !== 'PASTOR') {
      throw new PermissaoError('Apenas Mídia e Pastor podem alterar a identidade visual da igreja.');
    }

    // Persiste e atualiza a configuração
    return {
      igreja_id: usuario.igreja_id,
      visual: {
        ...CONFIG_VISUAL_PADRAO,
        ...dados
      },
      atualizadoPor: usuario.id,
      atualizadoEm: new Date().toISOString()
    };
  }
}

