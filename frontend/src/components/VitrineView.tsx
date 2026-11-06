import React, { useEffect, useState } from 'react';
import { ApiClient } from '../api/client';

interface MidiaPublicada {
  id: string;
  tipo: 'BANNER' | 'FOTO' | 'AVISO' | 'VIDEO';
  titulo: string;
  descricao?: string;
  arquivoUrl?: string;
  videoUrl?: string;
  createdAt: string;
}

interface Evento {
  id: string;
  titulo: string;
  descricao?: string;
  dataInicio: string;
  dataFim: string;
  local?: string;
}

export const VitrineView: React.FC = () => {
  const [publicacoes, setPublicacoes] = useState<MidiaPublicada[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setCarregando(true);
    try {
      const [resMidia, resEventos] = await Promise.all([
        ApiClient.get('/midia/vitrine'),
        ApiClient.get('/calendario')
      ]);
      setPublicacoes(resMidia.publicacoes || []);
      setEventos(resEventos.eventos || []);
    } catch {
      // Falha graciosa
    } finally {
      setCarregando(false);
    }
  };

  if (carregando) {
    return <div className="text-center py-12 text-slate-400">Carregando vitrine da igreja...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Título da Vitrine */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Vitrine & Comunicação</h2>
        <p className="text-slate-400 text-sm">Avisos, destaques, vídeos e agenda oficial da congregação</p>
      </div>

      {/* Calendário de Eventos */}
      {eventos.length > 0 && (
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
            <span>📅</span>
            <span>Próximos Eventos e Cultos</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {eventos.map((ev) => (
              <div key={ev.id} className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider block mb-1">
                  {new Date(ev.dataInicio).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                </span>
                <h4 className="text-sm font-bold text-white mb-1">{ev.titulo}</h4>
                {ev.local && <p className="text-xs text-slate-400 mb-1">📍 {ev.local}</p>}
                {ev.descricao && <p className="text-xs text-slate-500 line-clamp-2">{ev.descricao}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Grid de Publicações da Vitrine */}
      <section>
        <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
          <span>📢</span>
          <span>Destaques e Avisos</span>
        </h3>

        {publicacoes.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
            Nenhum aviso ou banner publicado no momento.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {publicacoes.map((item) => (
              <article key={item.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
                {item.tipo === 'VIDEO' && item.videoUrl && item.videoUrl.includes('youtube') && (
                  <div className="aspect-video w-full bg-black">
                    <iframe
                      src={item.videoUrl.replace('watch?v=', 'embed/')}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title={item.titulo}
                    />
                  </div>
                )}

                {item.arquivoUrl && item.tipo !== 'VIDEO' && (
                  <div className="aspect-video w-full bg-slate-950 flex items-center justify-center overflow-hidden">
                    <img src={item.arquivoUrl} alt={item.titulo} className="w-full h-full object-cover" />
                  </div>
                )}

                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <span className="inline-block px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] font-semibold uppercase mb-2">
                      {item.tipo}
                    </span>
                    <h4 className="text-base font-bold text-white mb-1">{item.titulo}</h4>
                    {item.descricao && <p className="text-sm text-slate-400 mb-2">{item.descricao}</p>}
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Publicado em {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default VitrineView;

