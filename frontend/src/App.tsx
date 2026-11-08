import { useState } from 'react';
import { House, Store, Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginView from './components/LoginView';
import Layout from './components/Layout';
import CelulaView from './components/CelulaView';
import RedeView from './components/RedeView';
import PastorView from './components/PastorView';
import MidiaView from './components/MidiaView';
import VitrineView from './components/VitrineView';

type AbaExtra = 'minha' | 'vitrine';

function AppContent() {
  const { usuario, carregando } = useAuth();
  const [aba, setAba] = useState<AbaExtra>('minha');

  if (carregando) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 size={28} className="text-blue-500 animate-spin mx-auto" />
          <p className="text-slate-400 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!usuario) {
    return <LoginView />;
  }

  function renderizarTelaPrincipal() {
    if (aba === 'vitrine') return <VitrineView />;
    switch (usuario!.perfil) {
      case 'CELULA': return <CelulaView />;
      case 'REDE':   return <RedeView />;
      case 'PASTOR': return <PastorView />;
      case 'MIDIA':  return <MidiaView />;
      default:       return <VitrineView />;
    }
  }

  const labelMinha: Record<string, string> = {
    CELULA: 'Minha Célula',
    REDE: 'Minha Rede',
    PASTOR: 'Painel',
    MIDIA: 'Mídia',
  };

  const tabs = [
    { id: 'minha' as AbaExtra, label: labelMinha[usuario.perfil] ?? 'Principal', Icon: House },
    { id: 'vitrine' as AbaExtra, label: 'Vitrine', Icon: Store },
  ];

  return (
    <Layout abaAtiva={aba} setAbaAtiva={(novaAba: string) => setAba(novaAba as AbaExtra)}>
      {/* Barra de navegação inferior */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800/80 bg-slate-950/85 backdrop-blur-xl safe-bottom">
        <div className="max-w-5xl mx-auto px-3 py-2 flex gap-2">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setAba(id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                aba === id
                  ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </nav>

      {renderizarTelaPrincipal()}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
