/**
 * Normaliza os arquivos recebidos pelo multer.
 *
 * O multer pode entregar os arquivos em formatos diferentes:
 * - `.array('arquivos')` -> req.files é um ARRAY
 * - `.fields([{ name: 'arquivo' }, { name: 'arquivos' }])` -> req.files é um OBJETO
 *   com uma chave por nome de campo aceito.
 *
 * O front envia o campo "arquivo" (singular) e outras integrações usam
 * "arquivos" (plural). Aceitar os dois evita o erro "Unexpected file field".
 */
export function normalizarArquivos(files: any): any[] {
  if (!files) return [];
  if (Array.isArray(files)) return files;

  if (typeof files === 'object') {
    const lista: any[] = [];
    // Ordem de prioridade: "arquivo" (usado pelo app) e depois "arquivos" (API/antigos)
    for (const chave of ['arquivo', 'arquivos']) {
      const itens = files[chave];
      if (Array.isArray(itens)) lista.push(...itens);
      else if (itens) lista.push(itens);
    }
    if (lista.length > 0) return lista;

    // Qualquer outro campo aceito pelo multer (fallback)
    for (const valor of Object.values(files)) {
      if (Array.isArray(valor)) lista.push(...valor);
      else if (valor) lista.push(valor);
    }
    return lista;
  }

  return [];
}

/**
 * Tamanho de cada pedaço do arquivo gravado no banco (4 MB).
 * Um vídeo de 50 MB vira 13 pedaços: o banco nunca recebe um bytea gigante
 * (que estourava a memória da API) e o arquivo pode ser servido em partes.
 */
export const TAMANHO_PARTE_ARQUIVO = 4 * 1024 * 1024;

/**
 * Divide um buffer em pedaços de tamanho fixo.
 * O último pedaço pode ser menor.
 */
export function dividirEmPartes(
  buffer: Buffer,
  tamanhoParte: number = TAMANHO_PARTE_ARQUIVO
): Buffer[] {
  if (!buffer || buffer.length === 0) return [];
  const partes: Buffer[] = [];
  for (let inicio = 0; inicio < buffer.length; inicio += tamanhoParte) {
    partes.push(buffer.subarray(inicio, Math.min(inicio + tamanhoParte, buffer.length)));
  }
  return partes;
}

/**
 * Caminho (relativo à API) onde o arquivo do conteúdo é servido.
 * O front transforma em URL absoluta (urlMidia no frontend).
 */
export function caminhoArquivoMidia(id: string): string {
  return `/midia/${id}/arquivo`;
}

/**
 * Separa uma data URL (texto base64) em MIME + bytes.
 * Usado na migração das mídias antigas: fotos que estavam guardadas
 * como texto dentro da coluna arquivoUrl passam a ficar gravadas
 * no banco como bytes, igual aos vídeos.
 */
export function extrairDataUrl(dataUrl: string): { mimeType: string; bytes: Buffer } | null {
  const match = /^data:([^;]+);base64,(.*)$/.exec((dataUrl || '').trim());
  if (!match) return null;
  const mimeType = match[1] || 'application/octet-stream';
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length) return null;
  return { mimeType, bytes };
}
