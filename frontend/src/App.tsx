import { useState, useEffect, useRef } from 'react';
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

  // Dock flutuante some ao rolar para baixo e reaparece ao rolar para cima
  const [dockVisivel, setDockVisivel] = useState(true);
  const ultimaPosicaoScroll = useRef(0);

  useEffect(() => {
    const aoRolar = () => {
      const y = window.scrollY;
      const anterior = ultimaPosicaoScroll.current;
      if (y < anterior - 6 || y < 80) {
        setDockVisivel(true);
      } else if (y > anterior + 6) {
        setDockVisivel(false);
      }
      ultimaPosicaoScroll.current = y;
    };
    window.addEventListener('scroll', aoRolar, { passive: true });
    return () => window.removeEventListener('scroll', aoRolar);
  }, []);

  return (
    <Layout abaAtiva={aba} setAbaAtiva={(novaAba: string) => setAba(novaAba as AbaExtra)}>
      {/* Barra de navegação inferior (dock flutuante, some ao rolar para baixo) */}
      <nav
        className={`fixed bottom-3 left-0 right-0 z-50 px-4 safe-bottom transition-all duration-300 ${
          dockVisivel ? 'translate-y-0 opacity-100' : 'translate-y-[120%] opacity-0 pointer-events-none'
        }`}
      >
        <div className="max-w-md mx-auto flex gap-1 rounded-2xl border border-slate-800/80 bg-slate-950/90 backdrop-blur-xl shadow-2xl shadow-black/50 p-1.5">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setAba(id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                aba === id
                  ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
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
