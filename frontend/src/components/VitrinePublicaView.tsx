import React, { useEffect, useState } from 'react';
import { CalendarDays, Clock, MapPin, Megaphone, Newspaper, X, LogIn, Loader2, Church } from 'lucide-react';
import { ApiClient, fotoUtilizavel, urlMidia } from '../api/client';
import { SkeletonGrid } from './Skeleton';
import { useListaIncremental } from '../hooks/useListaIncremental';

interface MidiaPublicada {
  id: string;
  tipo: 'BANNER' | 'FOTO' | 'AVISO' | 'VIDEO';
  titulo: string;
  descricao?: string | null;
  arquivoUrl?: string | null;
  videoUrl?: string | null;
  createdAt: string;
}

interface Evento {
  id: string;
  titulo: string;
  descricao?: string | null;
  dataInicio: string;
  dataFim: string;
  local?: string | null;
}

interface Visual {
  corPrimaria?: string;
  corSecundaria?: string;
  corFundo?: string;
  logoUrl?: string | null;
  layoutDivulgacao?: string;
}

const badgeTipo: Record<string, { label: string; cor: string }> = {
  BANNER: { label: 'Banner', cor: 'badge-blue' },
  FOTO: { label: 'Foto', cor: 'badge-emerald' },
  AVISO: { label: 'Aviso', cor: 'badge-amber' },
  VIDEO: { label: 'Vídeo', cor: 'badge-purple' }
};

export interface VitrinePublicaProps {
  slug: string;
}

export const VitrinePublicaView: React.FC<VitrinePublicaProps> = ({ slug }) => {
  const [publicacoes, setPublicacoes] = useState<MidiaPublicada[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [visual, setVisual] = useState<Visual>({});
  const [nomeIgreja, setNomeIgreja] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ampliado, setAmpliado] = useState<MidiaPublicada | null>(null);

  const listaEventos = useListaIncremental(eventos, 12);
  const listaPublicacoes = useListaIncremental(publicacoes, 12);

  useEffect(() => {
    let cancelado = false;
    const carregar = async () => {
      setCarregando(true);
      setErro(null);
      try {
        const res: any = await ApiClient.get(`/publico/vitrine/${encodeURIComponent(slug)}`);
        if (cancelado) return;
        setNomeIgreja(res?.igreja?.nome || '');
        setVisual(res?.visual || {});
        setPublicacoes(res?.publicacoes || []);
        setEventos(res?.eventos || []);
      } catch (err: any) {
        if (!cancelado) {
          setErro(err?.response?.status === 404
            ? 'Igreja não encontrada. Confira o link ou o identificador da igreja.'
            : 'Não foi possível carregar a vitrine da igreja agora.');
        }
      } finally {
        if (!cancelado) setCarregando(false);
      }
    };
    carregar();
    return () => { cancelado = true; };
  }, [slug]);

  const corPrimaria = visual.corPrimaria || '#2563eb';
  const corSecundaria = visual.corSecundaria || '#f59e0b';
  const logoUrl = urlMidia(visual.logoUrl);
  const layout = visual.layoutDivulgacao === 'CARROSSEL' || visual.layoutDivulgacao === 'LISTA'
    ? visual.layoutDivulgacao
    : 'GRID';

  if (carregando) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="max-w-4xl mx-auto px-4 py-10">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-6">
            <Loader2 size={16} className="animate-spin" />
            Carregando a vitrine...
          </div>
          <SkeletonGrid count={4} cols="grid-cols-1 md:grid-cols-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-10">
      {/* Cabeçalho da igreja */}
      <header className="relative overflow-hidden border-b border-slate-800/80">
        <div
          className="absolute inset-0 opacity-25 pointer-events-none"
          style={{ background: `radial-gradient(120% 90% at 50% 0%, ${corPrimaria}55, transparent 70%)` }}
          aria-hidden="true"
        />
        <div className="relative max-w-4xl mx-auto px-4 pt-8 pb-7 text-center">
          {logoUrl && fotoUtilizavel(logoUrl) && (
            <img
              loading="lazy"
              decoding="async"
              src={logoUrl}
              alt={nomeIgreja || 'Logo da igreja'}
              className="mx-auto max-h-24 object-contain drop-shadow-lg mb-4"
            />
          )}
          <span className="eyebrow inline-flex items-center gap-1.5" style={{ color: corPrimaria }}>
            <Megaphone size={12} />
            Comunicação da Igreja
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-2">
            {nomeIgreja || 'Vitrine da Igreja'}
          </h1>
          <div
            className="mt-3 h-1 w-24 rounded-full mx-auto"
            style={{ background: `linear-gradient(90deg, ${corPrimaria}, ${corSecundaria})` }}
            aria-hidden="true"
          />
          <p className="section-sub mt-3">Avisos, destaques, vídeos e agenda oficial da congregação</p>
          <a href="/" className="btn-ghost btn-sm inline-flex items-center gap-1.5 mt-5">
            <LogIn size={14} />
            Entrar no sistema
          </a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-6 space-y-6 anim-fade-up">
        {erro && (
          <div className="card card-pad text-center py-10">
            <Church size={26} className="mx-auto mb-2 text-slate-600" />
            <p className="text-slate-300 text-sm">{erro}</p>
            <a href="/" className="btn btn-sm mt-4 inline-block">Ir para o login</a>
          </div>
        )}

        {/* Agenda */}
        {!erro && eventos.length > 0 && (
          <section className="card card-pad">
            <h2 className="section-title mb-4 flex items-center gap-2">
              <span
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: `${corPrimaria}22`, color: corPrimaria }}
              >
                <CalendarDays size={15} />
              </span>
              Próximos Eventos e Cultos
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {listaEventos.visiveis.map((ev) => {
                const data = new Date(ev.dataInicio);
                return (
                  <div key={ev.id} className="card-soft card-hover p-3.5 flex gap-3">
                    <div
                      className="w-12 shrink-0 rounded-lg border flex flex-col items-center justify-center py-1.5"
                      style={{ background: `${corPrimaria}1a`, borderColor: `${corPrimaria}44` }}
                    >
                      <span className="text-[10px] font-bold uppercase leading-none" style={{ color: corPrimaria }}>
                        {data.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
                      </span>
                      <span className="text-lg font-extrabold text-white leading-none mt-0.5">
                        {String(data.getDate()).padStart(2, '0')}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1" style={{ color: corPrimaria }}>
                        <Clock size={10} />
                        {data.toLocaleDateString('pt-BR', { weekday: 'long' })}
                      </span>
                      <h3 className="text-sm font-bold text-white mt-0.5 truncate">{ev.titulo}</h3>
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

        {/* Publicações */}
        {!erro && (
          <section>
            <h2 className="section-title mb-3 flex items-center gap-2">
              <span
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: `${corSecundaria}22`, color: corSecundaria }}
              >
                <Newspaper size={15} />
              </span>
              Destaques e Avisos
            </h2>

            {publicacoes.length === 0 ? (
              <div className="empty-state">
                <Megaphone size={22} className="mx-auto mb-2 text-slate-600" />
                Nenhum aviso ou banner publicado no momento.
              </div>
            ) : (
              <div
                className={
                  layout === 'CARROSSEL'
                    ? 'flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4'
                    : layout === 'LISTA'
                      ? 'flex flex-col gap-3'
                      : 'grid grid-cols-1 sm:grid-cols-2 gap-4'
                }
              >
                {listaPublicacoes.visiveis.map((item) => {
                  const badge = badgeTipo[item.tipo] || badgeTipo.AVISO;
                  const isVideo = item.tipo === 'VIDEO';
                  const ehHorizontal = layout === 'LISTA';
                  // Vídeo gravado no banco vem como caminho relativo: vira URL da API
                  const arquivoUrl = urlMidia(item.arquivoUrl);
                  return (
                    <article
                      key={item.id}
                      className={`card overflow-hidden flex flex-col card-hover ${
                        layout === 'CARROSSEL' ? 'snap-start shrink-0 w-[85%] sm:w-[400px]' : ''
                      }`}
                      style={ehHorizontal ? { flexDirection: 'row' } : undefined}
                    >
                      {isVideo && item.videoUrl && item.videoUrl.includes('youtube') && (
                        <div className={ehHorizontal ? 'w-full sm:w-2/5 shrink-0 h-36' : 'aspect-video w-full bg-black'}>
                          <iframe
                            src={item.videoUrl.replace('watch?v=', 'embed/')}
                            className="w-full h-full border-0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            title={item.titulo}
                          />
                        </div>
                      )}

                      {isVideo && arquivoUrl && !item.videoUrl && (
                        <div className={ehHorizontal ? 'w-full sm:w-2/5 shrink-0 h-36' : 'aspect-video w-full bg-black'}>
                          <video src={arquivoUrl} controls className="w-full h-full" title={item.titulo} playsInline />
                        </div>
                      )}

                      {arquivoUrl && !isVideo && (
                        <div
                          className={`relative bg-slate-950 overflow-hidden cursor-pointer shrink-0 ${
                            ehHorizontal ? 'w-full sm:w-2/5 h-36 sm:h-auto' : 'aspect-video w-full'
                          }`}
                          onClick={() => setAmpliado(item)}
                        >
                          <img
                            loading="lazy"
                            decoding="async"
                            src={arquivoUrl}
                            alt={item.titulo}
                            className="w-full h-full object-cover"
                            title={item.titulo}
                          />
                          {layout !== 'LISTA' && (
                            <div className="absolute bottom-0 left-0 right-0 bg-slate-950/80 p-4">
                              <div className="flex items-center justify-between gap-2">
                                <span className={badge.cor}>{badge.label}</span>
                                <span className="text-[11px] text-slate-500">
                                  {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                                </span>
                              </div>
                              <h3 className="text-base font-bold text-white truncate">{item.titulo}</h3>
                            </div>
                          )}
                        </div>
                      )}

                      {!item.arquivoUrl && !item.videoUrl && (
                        <div
                          className={`${
                            ehHorizontal ? 'w-full sm:w-2/5 shrink-0 h-36 sm:h-auto' : 'aspect-video w-full'
                          } bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center text-slate-700`}
                        >
                          <Megaphone size={34} />
                        </div>
                      )}

                      {((!item.arquivoUrl && !item.videoUrl) || layout === 'LISTA') && (
                        <div className={`p-4 flex-1 flex flex-col justify-between gap-2 ${ehHorizontal ? 'min-w-0' : ''}`}>
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className={badge.cor}>{badge.label}</span>
                              <span className="text-[11px] text-slate-500">
                                {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                            <h3 className="text-base font-bold text-white">{item.titulo}</h3>
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
        )}

        <footer className="pt-6 text-center text-[11px] text-slate-600">
          {nomeIgreja} • Vitrine pública • IEQ Conecta
        </footer>
      </main>

      {/* Visualizador em destaque */}
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
          <div className="max-w-4xl w-full max-h-full flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <img
              loading="lazy"
              decoding="async"
              src={urlMidia(ampliado.arquivoUrl) || ''}
              alt={ampliado.titulo}
              className="w-full max-h-[75vh] object-contain rounded-2xl border border-slate-800 shadow-2xl"
            />
            <div className="rounded-xl bg-slate-950/90 border border-slate-800 p-3.5">
              <span className={badgeTipo[ampliado.tipo]?.cor || badgeTipo.AVISO.cor}>
                {badgeTipo[ampliado.tipo]?.label || badgeTipo.AVISO.label}
              </span>
              <h3 className="text-lg font-bold text-white mt-1.5">{ampliado.titulo}</h3>
              {ampliado.descricao && <p className="text-sm text-slate-400 mt-1">{ampliado.descricao}</p>}
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

export default VitrinePublicaView;
