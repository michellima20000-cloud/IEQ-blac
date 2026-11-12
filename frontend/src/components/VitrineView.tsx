import React, { useEffect, useState } from 'react';
import { CalendarDays, Megaphone, MapPin, Clock, Video, Newspaper, X } from 'lucide-react';
import { ApiClient } from '../api/client';
import { SkeletonGrid } from './Skeleton';
import { useListaIncremental } from '../hooks/useListaIncremental';

interface MidiaPublicada {
  id: string;
  tipo: 'BANNER' | 'FOTO' | 'AVISO' | 'VIDEO';
  titulo: string;
  descricao?: string;
  arquivoUrl?: string;
  videoUrl?: string;
  createdAt: string;
  autorId?: string;
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
  const [ampliado, setAmpliado] = useState<MidiaPublicada | null>(null);

  // Paginação incremental: menos iframes/imagens montadas de uma vez
  const listaEventos = useListaIncremental(eventos, 12);
  const listaPublicacoes = useListaIncremental(publicacoes, 12);

  useEffect(() => {
    carregarDados();
    const aoAtualizar = () => {
      carregarDados();
    };
    window.addEventListener('visual-atualizada', aoAtualizar);
    return () => window.removeEventListener('visual-atualizada', aoAtualizar);
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
    return <SkeletonGrid count={4} cols="grid-cols-1 md:grid-cols-2" />;
  }

  return (
    <div className="space-y-6 safe-bottom anim-fade-up">
      {/* Identidade visual da igreja */}
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
            {listaEventos.visiveis.map((ev) => {
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
          {listaEventos.restam > 0 && (
            <button onClick={listaEventos.carregarMais} className="btn-ghost btn-sm mx-auto block mt-4">
              Carregar mais ({listaEventos.restam} restantes)
            </button>
          )}
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
            {listaPublicacoes.visiveis.map((item) => {
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
                    <div
                      className="relative aspect-video bg-slate-950 overflow-hidden cursor-pointer"
                      onClick={() => setAmpliado(item)}
                    >
                      <img loading="lazy" decoding="async"
                        src={item.arquivoUrl}
                        alt={item.titulo}
                        className="w-full h-full object-cover transition-opacity duration-300"
                        title={item.titulo}
                      />
                      {/* Overlay inferior com info aparece ao passar o mouse */}
                      <div
                        className="absolute bottom-0 left-0 right-0 bg-slate-950/80 backdrop-blur-sm p-4 transition-all duration-300 group-hover:opacity-100"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={badge.cor}>{badge.label}</span>
                          <span className="text-[11px] text-slate-500">
                            {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <h4 className="text-base font-bold text-white truncate">{item.titulo}</h4>
                        {item.descricao && (
                          <p className="text-sm text-slate-400 mt-1 line-clamp-2">{item.descricao}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {!item.arquivoUrl && !item.videoUrl && (
                    <div className="aspect-video w-full bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center text-slate-700">
                      <Video size={34} />
                    </div>
                  )}

                  {!item.arquivoUrl && !item.videoUrl && (
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
                  )}
                 </article>
               );
             })}
           </div>
         )}
        {listaPublicacoes.restam > 0 && (
          <button onClick={listaPublicacoes.carregarMais} className="btn-ghost btn-sm mx-auto block mt-4">
            Carregar mais ({listaPublicacoes.restam} restantes)
          </button>
        )}
      </section>

      {/* Visualizador em destaque (lightbox) */}
      {ampliado && (
        <div
          className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8"
          onClick={() => setAmpliado(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Visualização ampliada: ${ampliado.titulo}`}
        >
          <button
            type="button"
            onClick={() => setAmpliado(null)}
            aria-label="Fechar visualização"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-slate-900/80 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors z-10"
          >
            <X size={18} />
          </button>
          <div
            className="max-w-4xl w-full max-h-full flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <img loading="lazy" decoding="async"
              src={ampliado.arquivoUrl}
              alt={ampliado.titulo}
              className="w-full max-h-[75vh] object-contain rounded-2xl border border-slate-800 shadow-2xl"
            />
            <div className="rounded-xl bg-slate-950/90 border border-slate-800 p-3.5">
              <span className={badgeTipo[ampliado.tipo]?.cor || badgeTipo.AVISO.cor}>
                {badgeTipo[ampliado.tipo]?.label || badgeTipo.AVISO.label}
              </span>
              <h4 className="text-lg font-bold text-white mt-1.5">{ampliado.titulo}</h4>
              {ampliado.descricao && (
                <p className="text-sm text-slate-400 mt-1">{ampliado.descricao}</p>
              )}
              <p className="text-xs text-slate-500 mt-1.5">
                Publicado em {new Date(ampliado.createdAt).toLocaleDateString('pt-BR')} • toque fora ou no ✕ para fechar
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VitrineView;
