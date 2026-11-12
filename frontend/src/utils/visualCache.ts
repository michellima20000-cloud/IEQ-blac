// Cache local da identidade visual da igreja.
// Garante que cores/logo/layout escolhidos pela equipe de mídia "grudem"
// instantaneamente, mesmo se a API demorar (Render cold start) ou falhar.
const CHAVE = 'ieq_visual';

export interface IdentidadeVisualCache {
  logoUrl?: string | null;
  corPrimaria?: string;
  corSecundaria?: string;
  layoutDivulgacao?: string;
}

export function lerVisualCache(): IdentidadeVisualCache | null {
  try {
    const bruto = localStorage.getItem(CHAVE);
    return bruto ? (JSON.parse(bruto) as IdentidadeVisualCache) : null;
  } catch {
    return null;
  }
}

export function salvarVisualCache(visual: IdentidadeVisualCache) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(visual));
  } catch {
    /* armazenamento cheio/indisponível: ignora */
  }
}

// Aplica as variáveis CSS globais a partir do cache
export function aplicarVisualGeral(visual: IdentidadeVisualCache | null) {
  if (!visual) return;
  if (visual.corPrimaria) {
    document.documentElement.style.setProperty('--cor-primaria', visual.corPrimaria);
  }
  if (visual.corSecundaria) {
    document.documentElement.style.setProperty('--cor-secundaria', visual.corSecundaria);
  }
}
