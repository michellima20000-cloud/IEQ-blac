import React from 'react';
import { LogOut } from 'lucide-react';
import { useAuth, Perfil } from '../context/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
  abaAtiva: string;
  setAbaAtiva: (aba: string) => void;
}

const perfilLabels: Record<Perfil, { label: string; cor: string }> = {
  CELULA: { label: 'Líder de Célula', cor: 'badge-emerald' },
  REDE: { label: 'Líder de Rede', cor: 'badge-indigo' },
  PASTOR: { label: 'Pastor Titular', cor: 'badge-amber' },
  MIDIA: { label: 'Equipe de Mídia', cor: 'badge-purple' }
};

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { usuario, logout } = useAuth();

  if (!usuario) return <>{children}</>;

  const perfilInfo = perfilLabels[usuario.perfil] || { label: usuario.perfil, cor: 'badge-blue' };
  const iniciais = (usuario.nome || '?').trim().slice(0, 1).toUpperCase();

  return (
    <div className="min-h-screen text-slate-100 flex flex-col pb-24 sm:pb-16">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-extrabold text-white text-sm shadow-lg shadow-blue-600/25">
              {iniciais}
            </div>
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
