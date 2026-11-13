import React, { useEffect, useRef, useState } from 'react';
import { LogOut } from 'lucide-react';
import { useAuth, Perfil } from '../context/AuthContext';
import { api, urlMidia } from '../api/client';
import { lerVisualCache, salvarVisualCache, aplicarVisualGeral } from '../utils/visualCache';

interface LayoutProps {
  children: React.ReactNode;
  abaAtiva: string;
  setAbaAtiva: (aba: string) => void;
}

interface IdentidadeVisual {
  logoUrl?: string | null;
  corPrimaria?: string;
}

const perfilLabels: Record<Perfil, { label: string; cor: string }> = {
  CELULA: { label: 'Líder de Célula', cor: 'badge-emerald' },
  REDE: { label: 'Líder de Rede', cor: 'badge-indigo' },
  PASTOR: { label: 'Pastor Titular', cor: 'badge-amber' },
  MIDIA: { label: 'Equipe de Mídia', cor: 'badge-purple' },
  ADM: { label: 'Administrador', cor: 'badge-red' }
};

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { usuario, logout } = useAuth();
  const [visual, setVisual] = useState<IdentidadeVisual | null>(null);
  const jaCarregouRef = useRef(false);

  // Carrega a identidade visual da igreja (logo + cores) para exibir globalmente
  useEffect(() => {
    if (!usuario) { setVisual(null); jaCarregouRef.current = false; return; }
    let cancelado = false;
    // Aplica imediatamente o cache local (a mudança "gruda" sem esperar a API)
    const cache = lerVisualCache();
    if (cache) {
      setVisual(cache);
      aplicarVisualGeral(cache);
    }
    const carregarVisual = () => {
      api.get('/configuracoes/visual')
        .then((r) => {
          if (cancelado) return;
          const cfg = (r.data as any)?.visual ?? r.data ?? null;
          setVisual(cfg);
          jaCarregouRef.current = true;
          if (cfg) salvarVisualCache(cfg);
          aplicarVisualGeral(cfg);
        })
        .catch(() => { /* falha graciosa: usa avatar com iniciais */ });
    };
    carregarVisual();
    // Revalida quando a identidade visual é alterada em outra tela
    const aoAtualizar = () => carregarVisual();
    window.addEventListener('visual-atualizada', aoAtualizar);
    // Tenta novamente ao voltar o foco APENAS se nunca conseguiu carregar
    const aoFocar = () => { if (!jaCarregouRef.current) carregarVisual(); };
    window.addEventListener('focus', aoFocar);
    return () => {
      cancelado = true;
      window.removeEventListener('visual-atualizada', aoAtualizar);
      window.removeEventListener('focus', aoFocar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.id]);

  if (!usuario) return <>{children}</>;

  const perfilInfo = perfilLabels[usuario.perfil] || { label: usuario.perfil, cor: 'badge-blue' };
  const iniciais = (usuario.nome || '?').trim().slice(0, 1).toUpperCase();

  return (
    <div className="min-h-screen text-slate-100 flex flex-col pb-32">
      {/* Top Header (fundo quase sólido: blur no sticky custa caro no scroll mobile) */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/95">
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{ backgroundImage: 'linear-gradient(90deg, transparent, var(--cor-primaria, #3b82f6), transparent)' }}
        />
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            {visual?.logoUrl ? (
              <img
                src={urlMidia(visual.logoUrl) || ''}
                alt="Logo da igreja"
                loading="lazy"
                decoding="async"
                className="w-10 h-10 rounded-xl object-cover border border-slate-700/70 shadow-lg shadow-blue-600/25 bg-slate-900"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-extrabold text-white text-sm shadow-lg shadow-blue-600/25 ring-1 ring-blue-400/30">
                {iniciais}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-sm font-bold tracking-tight text-white leading-tight truncate">
                {usuario.igreja?.nome || 'IEQ Conecta'}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`badge ${perfilInfo.cor}`}>{perfilInfo.label}</span>
                <span className="text-xs text-slate-400 font-medium truncate max-w-[120px] sm:max-w-none">
                  {usuario.nome}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => logout()}
            className="btn-ghost btn-sm"
            title="Sair do sistema"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 animate-fade-up">
        {children}
      </main>
    </div>
  );
};

export default Layout;
