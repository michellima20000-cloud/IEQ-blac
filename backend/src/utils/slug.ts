/**
 * Normalização de identificadores (slug) de igreja.
 * Permite que o usuário digite "IEQ-CIDADE NOVA", "IEQ Cidade Nova",
 * "ieq_cidade_nova" ou "ieq-cidade-nova" e ainda encontre a igreja.
 */
export function normalizarSlug(valor: string): string {
  return (valor || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
}

// Slugs alternativos aceitos (evita bloqueio de login durante/ após migração)
export const SLUGS_ALTERNATIVOS: Record<string, string> = {
  'ieq-sede': 'ieq-cidade-nova',
  'ieq-cidade-nova': 'ieq-sede',
  'ieq cidade nova': 'ieq-cidade-nova',
};

export function candidatosSlug(valor: string): string[] {
  const bruto = (valor || '').trim();
  const norm = normalizarSlug(bruto);
  const lista: string[] = [];
  if (bruto) lista.push(bruto);
  if (norm && !lista.includes(norm)) lista.push(norm);
  const alternativo = SLUGS_ALTERNATIVOS[norm];
  if (alternativo && !lista.includes(alternativo)) lista.push(alternativo);
  return lista;
}
