import { useState } from 'react';

// Renderização incremental: mostra os primeiros N itens e "Carregar mais"
// evita montar centenas de cards de uma vez (travamento em listas longas)
export function useListaIncremental<T>(lista: T[] | undefined, passo = 20) {
  const [limite, setLimite] = useState(passo);
  const base = lista ?? [];
  const visiveis = base.slice(0, limite);
  const restam = base.length - visiveis.length;
  const carregarMais = () => setLimite((l) => l + passo);
  const reiniciar = () => setLimite(passo);
  return { visiveis, restam, carregarMais, reiniciar };
}
