import React, { useState, useEffect, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Megaphone, Upload, ClipboardList, Calendar, Palette, ImagePlus,
  Check, Inbox, MapPin, Pencil, Trash2, RotateCcw, Youtube,
  CircleCheck, TriangleAlert,
} from 'lucide-react';
import { api } from '../api/client';

interface MediaItem {
  id: string;
  tipo: 'BANNER' | 'FOTO' | 'AVISO' | 'VIDEO';
  titulo: string;
  descricao?: string;
  url?: string;
  youtubeUrl?: string;
  status: 'RASCUNHO' | 'PENDENTE' | 'PUBLICADO' | 'DEVOLVIDO';
  comentarioPastor?: string;
  criadoEm: string;
}

interface Evento {
  id: string;
  titulo: string;
  descricao?: string;
  dataInicio: string;
  dataFim?: string;
  tipo: string;
  local?: string;
}

interface ConfigVisual {
  corPrimaria: string;
  corSecundaria: string;
  logoUrl?: string;
  layoutDivulgacao: string;
}

type Aba = 'uploads' | 'calendario' | 'visual' | 'status';

const STATUS_LABEL: Record<string, string> = {
  RASCUNHO: 'Rascunho',
  PENDENTE: 'Aguardando aprovação',
  PUBLICADO: 'Publicado',
  DEVOLVIDO: 'Devolvido pelo pastor',
};

const STATUS_COR: Record<string, string> = {
  RASCUNHO: 'badge-slate',
  PENDENTE: 'badge-amber',
  PUBLICADO: 'badge-emerald',
  DEVOLVIDO: 'badge-red',
};

function msgErro(err: any, fallback: string): string {
  return err?.response?.data?.message ?? err?.message ?? fallback;
}

function lerArquivoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
    reader.readAsDataURL(file);
  });
}

function isoParaDatetimeLocal(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MidiaView() {
  const [aba, setAba] = useState<Aba>('uploads');
  const [midias, setMidias] = useState<MediaItem[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [visual, setVisual] = useState<ConfigVisual | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  // Form upload
  const [uploadTipo, setUploadTipo] = useState<'BANNER' | 'FOTO' | 'AVISO' | 'VIDEO'>('BANNER');
  const [uploadTitulo, setUploadTitulo] = useState('');
  const [uploadDescricao, setUploadDescricao] = useState('');
  const [uploadArquivo, setUploadArquivo] = useState<File | null>(null);
  const [uploadYoutube, setUploadYoutube] = useState('');
  const [uploadRequerAprovacao, setUploadRequerAprovacao] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Form evento
  const [eventoId, setEventoId] = useState<string | null>(null);
  const [eventoTitulo, setEventoTitulo] = useState('');
  const [eventoDesc, setEventoDesc] = useState('');
  const [eventoInicio, setEventoInicio] = useState('');
  const [eventoFim, setEventoFim] = useState('');
  const [eventoTipo, setEventoTipo] = useState('CULTO');
  const [eventoLocal, setEventoLocal] = useState('');

  // Form visual
  const [corPrimaria, setCorPrimaria] = useState('#2563eb');
  const [corSecundaria, setCorSecundaria] = useState('#f59e0b');
  const [layoutOpt, setLayoutOpt] = useState('GRID');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  const limparMsg = () => { setErro(''); setSucesso(''); };

  useEffect(() => {
    if (aba === 'uploads' || aba === 'status') carregarMidias();
    if (aba === 'calendario') carregarEventos();
    if (aba === 'visual') carregarVisual();
  }, [aba]);

  async function carregarMidias() {
    setCarregando(true);
    try {
      const r = await api.get('/midia/minhas');
      const lista = r.data?.conteudos ?? r.data?.itens ?? r.data ?? [];
      // Mapeia campos do backend para a interface local
      setMidias(lista.map((m: any) => ({
        ...m,
        criadoEm: m.createdAt || m.criadoEm,
        youtubeUrl: m.videoUrl || m.youtubeUrl,
        url: m.arquivoUrl || m.url,
      })));
      setErro('');
    } catch {
      setErro('Não foi possível carregar as mídias.');
    } finally {
      setCarregando(false);
    }
  }

  async function carregarEventos() {
    setCarregando(true);
    try {
      const r = await api.get('/calendario');
      setEventos((r.data?.eventos ?? r.data ?? []).map((ev: any) => ({
        ...ev,
        dataInicio: ev.dataInicio || ev.inicio,
        dataFim: ev.dataFim || ev.fim,
      })));
      setErro('');
    } catch {
      setErro('Não foi possível carregar o calendário.');
    } finally {
      setCarregando(false);
    }
  }

  async function carregarVisual() {
    setCarregando(true);
    try {
      const r = await api.get('/configuracoes/visual');
      const cfg: ConfigVisual = r.data?.visual ?? r.data ?? { corPrimaria: '#2563eb', corSecundaria: '#f59e0b', layoutDivulgacao: 'GRID' };
      setVisual(cfg);
      setCorPrimaria(cfg.corPrimaria);
      setCorSecundaria(cfg.corSecundaria);
      setLayoutOpt(cfg.layoutDivulgacao || 'GRID');
    } catch {
      setErro('Não foi possível carregar as configurações visuais.');
    } finally {
      setCarregando(false);
    }
  }

  async function enviarMidia(e: React.FormEvent) {
    e.preventDefault();
    limparMsg();
    if (!uploadTitulo.trim()) { setErro('Informe o título.'); return; }
    if (uploadTipo === 'VIDEO' && !uploadYoutube && !uploadArquivo) {
      setErro('Informe o link do YouTube ou selecione um arquivo de vídeo (máx. 50 MB).'); return;
    }
    if ((uploadTipo === 'BANNER' || uploadTipo === 'FOTO') && !uploadArquivo) {
      setErro('Selecione um arquivo de imagem.'); return;
    }
    if (uploadArquivo && uploadArquivo.size > 50 * 1024 * 1024) {
      setErro('O arquivo excede o limite de 50 MB.'); return;
    }

    setCarregando(true);
    try {
      let corpo: any = {
        tipo: uploadTipo,
        titulo: uploadTitulo,
        descricao: uploadDescricao || null,
        precisaAprovacao: uploadRequerAprovacao,
      };
      if (uploadYoutube) corpo.videoUrl = uploadYoutube;
      if (uploadArquivo) {
        // Multipart com o arquivo binário (sem converter para base64,
        // que estourava a requisição e causava o erro "Falha ao buscar")
        const fd = new FormData();
        fd.append('tipo', corpo.tipo);
        fd.append('titulo', corpo.titulo);
        if (corpo.descricao) fd.append('descricao', corpo.descricao);
        fd.append('videoUrl', corpo.videoUrl || '');
        fd.append('precisaAprovacao', String(corpo.precisaAprovacao));
        fd.append('arquivo', uploadArquivo);
        corpo = fd;
      }

      await api.post('/midia', corpo);
      setSucesso('Mídia enviada com sucesso!');
      setUploadTitulo(''); setUploadDescricao(''); setUploadYoutube('');
      setUploadArquivo(null); if (fileRef.current) fileRef.current.value = '';
      await carregarMidias();
    } catch (err: any) {
      setErro(msgErro(err, 'Erro ao enviar a mídia.'));
    } finally {
      setCarregando(false);
    }
  }

  async function reenviarMidia(id: string) {
    limparMsg();
    setCarregando(true);
    try {
      await api.patch(`/midia/${id}`, { reenviarAprovacao: true });
      setSucesso('Mídia reenviada para aprovação.');
      await carregarMidias();
    } catch (err: any) {
      setErro(msgErro(err, 'Erro ao reenviar.'));
    } finally {
      setCarregando(false);
    }
  }

  async function salvarEvento(e: React.FormEvent) {
    e.preventDefault();
    limparMsg();
    if (!eventoTitulo.trim() || !eventoInicio) { setErro('Preencha título e data de início.'); return; }
    setCarregando(true);
    try {
      const payload = {
        titulo: eventoTitulo,
        descricao: eventoDesc || null,
        dataInicio: eventoInicio,
        dataFim: eventoFim || eventoInicio,
        tipo: eventoTipo,
        local: eventoLocal || null,
      };
      if (eventoId) await api.patch(`/calendario/${eventoId}`, payload);
      else await api.post('/calendario', payload);
      setSucesso(eventoId ? 'Evento atualizado!' : 'Evento criado!');
      limparEvento();
      await carregarEventos();
    } catch (err: any) {
      setErro(msgErro(err, 'Erro ao salvar evento.'));
    } finally {
      setCarregando(false);
    }
  }

  async function excluirEvento(id: string) {
    if (!window.confirm('Excluir este evento?')) return;
    limparMsg();
    setCarregando(true);
    try {
      await api.delete(`/calendario/${id}`);
      setSucesso('Evento excluído.');
      await carregarEventos();
    } catch (err: any) {
      setErro(msgErro(err, 'Erro ao excluir evento.'));
    } finally {
      setCarregando(false);
    }
  }

  function editarEvento(ev: Evento) {
    setEventoId(ev.id);
    setEventoTitulo(ev.titulo);
    setEventoDesc(ev.descricao ?? '');
    setEventoInicio(isoParaDatetimeLocal(ev.dataInicio));
    setEventoFim(isoParaDatetimeLocal(ev.dataFim));
    setEventoTipo(ev.tipo || 'OUTRO');
    setEventoLocal(ev.local ?? '');
  }

  function limparEvento() {
    setEventoId(null); setEventoTitulo(''); setEventoDesc('');
    setEventoInicio(''); setEventoFim(''); setEventoTipo('CULTO'); setEventoLocal('');
  }

  async function salvarVisual(e: React.FormEvent) {
    e.preventDefault();
    limparMsg();
    setCarregando(true);
    try {
      const payload: any = {
        corPrimaria,
        corSecundaria,
        layoutDivulgacao: layoutOpt,
      };
      if (logoFile) payload.logoUrl = await lerArquivoDataUrl(logoFile);
      await api.patch('/configuracoes/visual', payload);
      setSucesso('Configurações visuais salvas!');
      setLogoFile(null); if (logoRef.current) logoRef.current.value = '';
      await carregarVisual();
    } catch (err: any) {
      setErro(msgErro(err, 'Erro ao salvar configurações.'));
    } finally {
      setCarregando(false);
    }
  }

  const abas: { id: Aba; label: string; Icon: LucideIcon }[] = [
    { id: 'uploads', label: 'Enviar', Icon: Upload },
    { id: 'status', label: 'Status', Icon: ClipboardList },
    { id: 'calendario', label: 'Calendário', Icon: Calendar },
    { id: 'visual', label: 'Visual', Icon: Palette },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header da Mídia */}
      <div className="card card-pad relative overflow-hidden">
        <div className="absolute -top-24 -right-16 w-56 h-56 rounded-full bg-blue-600/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-10 w-44 h-44 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />
        <div className="relative">
          <span className="eyebrow flex items-center gap-1.5">
            <Megaphone size={12} />
            Equipe de Mídia
          </span>
          <h2 className="page-title mt-1.5">Mídia</h2>
          <p className="section-sub mt-1">
            Publique conteúdo, acompanhe aprovações e organize o calendário da igreja
          </p>
        </div>
      </div>

      {/* Abas */}
      <nav className="flex flex-wrap gap-2">
        {abas.map(a => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={`tab flex items-center gap-1.5 ${aba === a.id ? 'tab-active' : ''}`}
          >
            <a.Icon size={14} />
            {a.label}
          </button>
        ))}
      </nav>

      {/* Mensagens */}
      {erro && (
        <div className="alert-error">
          <span className="flex items-center gap-2 min-w-0">
            <TriangleAlert size={15} className="shrink-0" />
            <span>{erro}</span>
          </span>
        </div>
      )}
      {sucesso && (
        <div className="alert-success">
          <span className="flex items-center gap-2 min-w-0">
            <CircleCheck size={15} className="shrink-0" />
            <span>{sucesso}</span>
          </span>
        </div>
      )}

      {/* ABA: Enviar */}
      {aba === 'uploads' && (
        <form onSubmit={enviarMidia} className="card card-pad space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <ImagePlus size={15} />
            </span>
            <h2 className="section-title">Nova Mídia</h2>
          </div>

          <div>
            <label className="label">Tipo</label>
            <select
              value={uploadTipo}
              onChange={e => setUploadTipo(e.target.value as any)}
              className="input"
            >
              <option value="BANNER">Banner</option>
              <option value="FOTO">Foto</option>
              <option value="AVISO">Aviso</option>
              <option value="VIDEO">Vídeo</option>
            </select>
          </div>

          <div>
            <label className="label">Título *</label>
            <input
              type="text"
              value={uploadTitulo}
              onChange={e => setUploadTitulo(e.target.value)}
              className="input"
              placeholder="Título da mídia"
            />
          </div>

          <div>
            <label className="label">Descrição</label>
            <textarea
              value={uploadDescricao}
              onChange={e => setUploadDescricao(e.target.value)}
              rows={3}
              className="input resize-none"
              placeholder="Descrição (opcional)"
            />
          </div>

          {uploadTipo === 'VIDEO' ? (
            <div className="space-y-3">
              <div>
                <label className="label">Link do YouTube (não listado)</label>
                <input
                  type="url"
                  value={uploadYoutube}
                  onChange={e => setUploadYoutube(e.target.value)}
                  className="input"
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </div>
              <p className="text-xs text-slate-500 text-center">— ou —</p>
              <div>
                <label className="label">Arquivo de vídeo (máx. 50 MB)</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="video/*"
                  onChange={e => setUploadArquivo(e.target.files?.[0] ?? null)}
                  className="input"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="label">Arquivo (imagem)</label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={e => setUploadArquivo(e.target.files?.[0] ?? null)}
                className="input"
              />
            </div>
          )}

          <label className="card-soft card-hover px-3.5 py-3 flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={uploadRequerAprovacao}
              onChange={e => setUploadRequerAprovacao(e.target.checked)}
              className="w-4 h-4 accent-blue-500"
            />
            <span className="text-sm text-slate-300">Requer aprovação do pastor antes de publicar</span>
          </label>

          <button
            type="submit"
            disabled={carregando}
            className="btn-primary w-full"
          >
            <Upload size={16} />
            {carregando ? 'Enviando...' : 'Enviar Mídia'}
          </button>
        </form>
      )}

      {/* ABA: Status */}
      {aba === 'status' && (
        <section className="card card-pad">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <ClipboardList size={15} />
              </span>
              <h2 className="section-title">Minhas Mídias</h2>
            </div>
            {midias.length > 0 && <span className="badge-blue">{midias.length} mídias</span>}
          </div>

          {carregando && (
            <div className="loading-state">
              <div className="w-7 h-7 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin" />
              Carregando...
            </div>
          )}
          {!carregando && midias.length === 0 && (
            <div className="empty-state border-0 bg-transparent p-8">
              <Inbox size={22} className="block mx-auto mb-2 text-slate-600" />
              Nenhuma mídia enviada ainda.
            </div>
          )}

          <div className="space-y-3">
            {midias.map(m => (
              <div key={m.id} className="card-soft card-hover p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white">{m.titulo}</p>
                    <p className="text-xs text-slate-400 mt-1">{m.tipo} · {new Date(m.criadoEm).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <span className={STATUS_COR[m.status]}>
                    {STATUS_LABEL[m.status]}
                  </span>
                </div>
                {m.status === 'DEVOLVIDO' && m.comentarioPastor && (
                  <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-300">
                    <p className="font-semibold mb-1 flex items-center gap-1.5">
                      <TriangleAlert size={12} />
                      Comentário do pastor:
                    </p>
                    <p>{m.comentarioPastor}</p>
                  </div>
                )}
                {m.status === 'DEVOLVIDO' && (
                  <button
                    onClick={() => reenviarMidia(m.id)}
                    disabled={carregando}
                    className="btn-soft-success btn-sm w-full"
                  >
                    <RotateCcw size={13} />
                    Corrigir e Reenviar para Aprovação
                  </button>
                )}
                {m.youtubeUrl && (
                  <a
                    href={m.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 underline"
                  >
                    <Youtube size={13} />
                    Ver vídeo no YouTube
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ABA: Calendário */}
      {aba === 'calendario' && (
        <div className="space-y-5">
          <form onSubmit={salvarEvento} className="card card-pad space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Calendar size={15} />
              </span>
              <h2 className="section-title">{eventoId ? 'Editar Evento' : 'Novo Evento'}</h2>
            </div>

            <div>
              <label className="label">Tipo</label>
              <select
                value={eventoTipo}
                onChange={e => setEventoTipo(e.target.value)}
                className="input"
              >
                <option value="CULTO">Culto</option>
                <option value="CONFERENCIA">Conferência</option>
                <option value="REUNIAO">Reunião</option>
                <option value="DATA_ESPECIAL">Data Especial</option>
                <option value="OUTRO">Outro</option>
              </select>
            </div>

            <div>
              <label className="label">Título *</label>
              <input
                type="text"
                value={eventoTitulo}
                onChange={e => setEventoTitulo(e.target.value)}
                className="input"
                placeholder="Nome do evento"
              />
            </div>

            <div>
              <label className="label">Descrição</label>
              <textarea
                value={eventoDesc}
                onChange={e => setEventoDesc(e.target.value)}
                rows={2}
                className="input resize-none"
              />
            </div>

            <div>
              <label className="label">Local</label>
              <input
                type="text"
                value={eventoLocal}
                onChange={e => setEventoLocal(e.target.value)}
                className="input"
                placeholder="Ex.: Templo principal, Online..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Início *</label>
                <input
                  type="datetime-local"
                  value={eventoInicio}
                  onChange={e => setEventoInicio(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Fim</label>
                <input
                  type="datetime-local"
                  value={eventoFim}
                  onChange={e => setEventoFim(e.target.value)}
                  className="input"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={carregando}
                className="btn-primary flex-1"
              >
                <Check size={16} />
                {carregando ? 'Salvando...' : (eventoId ? 'Atualizar' : 'Criar Evento')}
              </button>
              {eventoId && (
                <button type="button" onClick={limparEvento} className="btn-ghost">
                  Cancelar
                </button>
              )}
            </div>
          </form>

          <section className="card card-pad">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                  <Calendar size={15} />
                </span>
                <h3 className="section-title">Próximos Eventos</h3>
              </div>
              {eventos.length > 0 && <span className="badge-blue">{eventos.length} eventos</span>}
            </div>

            {carregando && (
              <div className="loading-state">
                <div className="w-7 h-7 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin" />
                Carregando...
              </div>
            )}
            {!carregando && eventos.length === 0 && (
              <div className="empty-state border-0 bg-transparent p-8">
                <Calendar size={22} className="block mx-auto mb-2 text-slate-600" />
                Nenhum evento cadastrado.
              </div>
            )}

            <div className="space-y-3">
              {eventos.map(ev => (
                <div key={ev.id} className="card-soft card-hover p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white">{ev.titulo}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-1">
                      <span>{ev.tipo}</span>
                      <span className="flex items-center gap-1.5">
                        <Calendar size={11} className="text-blue-400" />
                        {new Date(ev.dataInicio).toLocaleString('pt-BR')}
                      </span>
                      {ev.local && (
                        <span className="flex items-center gap-1.5">
                          <MapPin size={11} className="text-emerald-400" />
                          {ev.local}
                        </span>
                      )}
                    </div>
                    {ev.descricao && <p className="text-xs text-slate-400 mt-1">{ev.descricao}</p>}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      onClick={() => editarEvento(ev)}
                      className="btn-ghost btn-sm"
                    >
                      <Pencil size={12} />
                      Editar
                    </button>
                    <button
                      onClick={() => excluirEvento(ev.id)}
                      className="btn-soft-danger btn-sm"
                    >
                      <Trash2 size={12} />
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ABA: Visual */}
      {aba === 'visual' && (
        <form onSubmit={salvarVisual} className="card card-pad space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Palette size={15} />
            </span>
            <h2 className="section-title">Personalização Visual</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Cor Primária</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={corPrimaria}
                  onChange={e => setCorPrimaria(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-slate-700/70 bg-slate-950/80 cursor-pointer p-1"
                />
                <span className="text-xs text-slate-400 font-mono">{corPrimaria}</span>
              </div>
            </div>
            <div>
              <label className="label">Cor Secundária</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={corSecundaria}
                  onChange={e => setCorSecundaria(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-slate-700/70 bg-slate-950/80 cursor-pointer p-1"
                />
                <span className="text-xs text-slate-400 font-mono">{corSecundaria}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="label">Layout das telas de divulgação</label>
            <select
              value={layoutOpt}
              onChange={e => setLayoutOpt(e.target.value)}
              className="input"
            >
              <option value="GRID">Grade</option>
              <option value="CARROSSEL">Carrossel</option>
              <option value="LISTA">Lista</option>
            </select>
          </div>

          <div>
            <label className="label">Logo da Igreja</label>
            {visual?.logoUrl && (
              <img src={visual.logoUrl} alt="Logo atual" className="h-14 mb-2 rounded-xl border border-slate-700/70" />
            )}
            <input
              ref={logoRef}
              type="file"
              accept="image/*"
              onChange={e => setLogoFile(e.target.files?.[0] ?? null)}
              className="input"
            />
          </div>

          {/* Preview das cores */}
          <div className="rounded-xl overflow-hidden border border-slate-700/70">
            <div className="p-3 text-white text-sm font-semibold text-center" style={{ backgroundColor: corPrimaria }}>
              Exemplo de Cabeçalho
            </div>
            <div className="p-3 text-white text-xs text-center" style={{ backgroundColor: corSecundaria }}>
              Área de conteúdo
            </div>
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="btn-primary w-full"
          >
            <Check size={16} />
            {carregando ? 'Salvando...' : 'Salvar Configurações Visuais'}
          </button>
        </form>
      )}
    </div>
  );
}
