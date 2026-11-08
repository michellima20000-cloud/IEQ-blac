import React, { useEffect, useState } from 'react';
import { CalendarDays, Megaphone, MapPin, Clock, Video, Newspaper } from 'lucide-react';
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

const badgeTipo: Record<string, { label: string; cor: string }> = {
  BANNER: { label: 'Banner', cor: 'badge-blue' },
  FOTO: { label: 'Foto', cor: 'badge-emerald' },
  AVISO: { label: 'Aviso', cor: 'badge-amber' },
  VIDEO: { label: 'Vídeo', cor: 'badge-purple' },
};

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
    return (
      <div className="loading-state">
        <div className="w-7 h-7 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin" />
        Carregando vitrine da igreja...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Título da Vitrine */}
      <div>
        <span className="eyebrow flex items-center gap-1.5">
          <Megaphone size={12} />
          Comunicação
        </span>
        <h2 className="page-title mt-1.5">Vitrine & Comunicação</h2>
        <p className="section-sub mt-1">Avisos, destaques, vídeos e agenda oficial da congregação</p>
      </div>

      {/* Calendário de Eventos */}
      {eventos.length > 0 && (
        <section className="card card-pad">
          <h3 className="section-title mb-4 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <CalendarDays size={15} />
            </span>
            Próximos Eventos e Cultos
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {eventos.map((ev) => {
              const data = new Date(ev.dataInicio);
              return (
                <div key={ev.id} className="card-soft card-hover p-3.5 flex gap-3">
                  <div className="w-12 shrink-0 rounded-lg bg-blue-500/10 border border-blue-500/20 flex flex-col items-center justify-center py-1.5">
                    <span className="text-[10px] font-bold text-blue-400 uppercase leading-none">
                      {data.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
                    </span>
                    <span className="text-lg font-extrabold text-white leading-none mt-0.5">
                      {String(data.getDate()).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1">
                      <Clock size={10} />
                      {data.toLocaleDateString('pt-BR', { weekday: 'long' })}
                    </span>
                    <h4 className="text-sm font-bold text-white mt-0.5 truncate">{ev.titulo}</h4>
                    {ev.local && (
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-1 truncate">
                        <MapPin size={11} className="shrink-0" />
                        {ev.local}
                      </p>
                    )}
                    {ev.descricao && <p className="text-xs text-slate-500 line-clamp-2 mt-1">{ev.descricao}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Grid de Publicações da Vitrine */}
      <section>
        <h3 className="section-title mb-3 flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <Newspaper size={15} />
          </span>
          Destaques e Avisos
        </h3>

        {publicacoes.length === 0 ? (
          <div className="empty-state">
            <Megaphone size={22} className="mx-auto mb-2 text-slate-600" />
            Nenhum aviso ou banner publicado no momento.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {publicacoes.map((item) => {
              const badge = badgeTipo[item.tipo] || badgeTipo.AVISO;
              const isVideo = item.tipo === 'VIDEO';
              return (
                <article key={item.id} className="card overflow-hidden flex flex-col card-hover">
                  {isVideo && item.videoUrl && item.videoUrl.includes('youtube') && (
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

                  {isVideo && item.arquivoUrl && !item.videoUrl && (
                    <div className="aspect-video w-full bg-black">
                      <video src={item.arquivoUrl} controls className="w-full h-full" title={item.titulo} />
                    </div>
                  )}

                  {item.arquivoUrl && !isVideo && (
                    <div className="aspect-video w-full bg-slate-950 overflow-hidden">
                      <img src={item.arquivoUrl} alt={item.titulo} className="w-full h-full object-cover" />
                    </div>
                  )}

                  {!item.arquivoUrl && !item.videoUrl && (
                    <div className="aspect-video w-full bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center text-slate-700">
                      <Video size={34} />
                    </div>
                  )}

                  <div className="p-4 flex-1 flex flex-col justify-between gap-2">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className={badge.cor}>{badge.label}</span>
                        <span className="text-[11px] text-slate-500">
                          {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-white">{item.titulo}</h4>
                      {item.descricao && (
                        <p className="text-sm text-slate-400 mt-1 line-clamp-3">{item.descricao}</p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default VitrineView;
