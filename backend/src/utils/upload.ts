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
