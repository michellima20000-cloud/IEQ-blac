import React from 'react';
import { useAuth, Perfil } from '../context/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
  abaAtiva: string;
  setAbaAtiva: (aba: string) => void;
}

const perfilLabels: Record<Perfil, { label: string; cor: string }> = {
  CELULA: { label: 'Líder de Célula', cor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  REDE: { label: 'Líder de Rede', cor: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
  PASTOR: { label: 'Pastor Titular', cor: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  MIDIA: { label: 'Equipe de Mídia', cor: 'bg-purple-500/20 text-purple-400 border-purple-500/30' }
};

export const Layout: React.FC<LayoutProps> = ({ children, abaAtiva, setAbaAtiva }) => {
  const { usuario, logout } = useAuth();

  if (!usuario) return <>{children}</>;

  const perfilInfo = perfilLabels[usuario.perfil] || { label: usuario.perfil, cor: 'bg-blue-500/20 text-blue-400' };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-20 sm:pb-0">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 sm:py-3.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white text-base shadow-md shadow-blue-500/20">
              I
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white leading-tight">
                {usuario.igreja?.nome || 'IEQ Conecta'}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${perfilInfo.cor}`}>
                  {perfilInfo.label}
                </span>
                <span className="text-xs text-slate-400 font-medium truncate max-w-[140px] sm:max-w-none">
                  {usuario.nome}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => logout()}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors border border-slate-700"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6">
        {children}
      </main>

      {/* Bottom Navigation Bar (Mobile-first) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 py-2 flex justify-around sm:hidden">
        <button
          onClick={() => setAbaAtiva('painel')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-xs font-medium transition-colors ${
            abaAtiva === 'painel' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-400 hover:text-white'
          }`}
        >
          <span className="text-base">📋</span>
          <span>Meu Painel</span>
        </button>

        <button
          onClick={() => setAbaAtiva('vitrine')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-xs font-medium transition-colors ${
            abaAtiva === 'vitrine' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-400 hover:text-white'
          }`}
        >
          <span className="text-base">🏛️</span>
          <span>Vitrine</span>
        </button>
      </nav>
    </div>
  );
};

export default Layout;

