import { useState } from 'react';
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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
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
    CELULA: '🏠 Minha Célula',
    REDE:   '🔗 Minha Rede',
    PASTOR: '📊 Painel',
    MIDIA:  '📢 Mídia',
  };

  return (
    <Layout abaAtiva={aba} setAbaAtiva={(novaAba: string) => setAba(novaAba as AbaExtra)}>
      {/* Barra de navegação inferior */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 flex z-50">
        <button
          onClick={() => setAba('minha')}
          className={`flex-1 py-3 text-xs font-medium flex flex-col items-center gap-0.5 transition-colors ${
            aba === 'minha' ? 'text-sky-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="text-lg leading-none">{aba === 'minha' ? '●' : '○'}</span>
          {labelMinha[usuario.perfil] ?? '🏠 Principal'}
        </button>
        <button
          onClick={() => setAba('vitrine')}
          className={`flex-1 py-3 text-xs font-medium flex flex-col items-center gap-0.5 transition-colors ${
            aba === 'vitrine' ? 'text-sky-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="text-lg leading-none">{aba === 'vitrine' ? '●' : '○'}</span>
          🌐 Vitrine
        </button>
      </nav>

      {/* Conteúdo com padding inferior */}
      <div className="pb-16">
        {renderizarTelaPrincipal()}
      </div>
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
