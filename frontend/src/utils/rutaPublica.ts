/**
 * Identifica a rota pública da vitrine pelo caminho da URL.
 * Formato aceito: /vitrine/<slug>  (ex.: /vitrine/ieq-cidade-nova)
 */
export function slugDaRotaPublica(pathname?: string): string | null {
  const caminho = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');
  const match = caminho.match(/^\/vitrine\/([^/]+)\/?$/);
  if (!match) return null;
  const slug = decodeURIComponent(match[1] || '').trim();
  return slug.length > 0 ? slug : null;
}

/** Link público da vitrine da igreja (usado para compartilhar e copiar). */
export function linkVitrinePublica(slug?: string | null): string {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return `${base}/vitrine/${slug || 'ieq-cidade-nova'}`;
}
