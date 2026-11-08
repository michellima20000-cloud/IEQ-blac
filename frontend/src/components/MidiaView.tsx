import React, { useState, useEffect, useRef } from 'react';
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
  RASCUNHO: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  PENDENTE: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  PUBLICADO: 'bg-green-500/20 text-green-300 border-green-500/30',
  DEVOLVIDO: 'bg-red-500/20 text-red-300 border-red-500/30',
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
      const payload: any = {
        tipo: uploadTipo,
        titulo: uploadTitulo,
        descricao: uploadDescricao || null,
        precisaAprovacao: uploadRequerAprovacao,
      };
      if (uploadYoutube) payload.videoUrl = uploadYoutube;
      if (uploadArquivo) {
        payload.arquivoUrl = await lerArquivoDataUrl(uploadArquivo);
        payload.tamanhoArquivoBytes = uploadArquivo.size;
      }

      await api.post('/midia', payload);
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

  const abas: { id: Aba; label: string; emoji: string }[] = [
    { id: 'uploads', label: 'Enviar', emoji: '📤' },
    { id: 'status', label: 'Status', emoji: '📋' },
    { id: 'calendario', label: 'Calendário', emoji: '📅' },
    { id: 'visual', label: 'Visual', emoji: '🎨' },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <h1 className="text-lg font-bold text-sky-400">📢 Mídia</h1>
      </header>

      {/* Abas */}
      <div className="flex border-b border-slate-700 bg-slate-800">
        {abas.map(a => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${aba === a.id ? 'text-sky-400 border-b-2 border-sky-400' : 'text-slate-400 hover:text-slate-200'}`}
          >
            {a.emoji} {a.label}
          </button>
        ))}
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-4">
        {/* Mensagens */}
        {erro && <div className="bg-red-900/40 border border-red-500/40 text-red-300 rounded-lg px-4 py-3 text-sm">{erro}</div>}
        {sucesso && <div className="bg-green-900/40 border border-green-500/40 text-green-300 rounded-lg px-4 py-3 text-sm">{sucesso}</div>}

        {/* ABA: Enviar */}
        {aba === 'uploads' && (
          <form onSubmit={enviarMidia} className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-slate-200">Nova Mídia</h2>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Tipo</label>
              <select
                value={uploadTipo}
                onChange={e => setUploadTipo(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100"
              >
                <option value="BANNER">Banner</option>
                <option value="FOTO">Foto</option>
                <option value="AVISO">Aviso</option>
                <option value="VIDEO">Vídeo</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Título *</label>
              <input
                type="text"
                value={uploadTitulo}
                onChange={e => setUploadTitulo(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100"
                placeholder="Título da mídia"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Descrição</label>
              <textarea
                value={uploadDescricao}
                onChange={e => setUploadDescricao(e.target.value)}
                rows={3}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 resize-none"
                placeholder="Descrição (opcional)"
              />
            </div>

            {uploadTipo === 'VIDEO' ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Link do YouTube (não listado)</label>
                  <input
                    type="url"
                    value={uploadYoutube}
                    onChange={e => setUploadYoutube(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100"
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                </div>
                <p className="text-xs text-slate-500 text-center">— ou —</p>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Arquivo de vídeo (máx. 50 MB)</label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="video/*"
                    onChange={e => setUploadArquivo(e.target.files?.[0] ?? null)}
                    className="w-full text-sm text-slate-300"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="text-xs text-slate-400 block mb-1">Arquivo (imagem)</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={e => setUploadArquivo(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-slate-300"
                />
              </div>
            )}

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={uploadRequerAprovacao}
                onChange={e => setUploadRequerAprovacao(e.target.checked)}
                className="w-4 h-4 accent-sky-500"
              />
              <span className="text-sm text-slate-300">Requer aprovação do pastor antes de publicar</span>
            </label>

            <button
              type="submit"
              disabled={carregando}
              className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold rounded-lg py-2 text-sm transition-colors"
            >
              {carregando ? 'Enviando...' : 'Enviar Mídia'}
            </button>
          </form>
        )}

        {/* ABA: Status */}
        {aba === 'status' && (
          <div className="space-y-3">
            <h2 className="font-semibold text-slate-200">Minhas Mídias</h2>
            {carregando && <p className="text-slate-400 text-sm text-center">Carregando...</p>}
            {!carregando && midias.length === 0 && (
              <p className="text-slate-500 text-sm text-center py-8">Nenhuma mídia enviada ainda.</p>
            )}
            {midias.map(m => (
              <div key={m.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-100 text-sm">{m.titulo}</p>
                    <p className="text-xs text-slate-500">{m.tipo} · {new Date(m.criadoEm).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COR[m.status]}`}>
                    {STATUS_LABEL[m.status]}
                  </span>
                </div>
                {m.status === 'DEVOLVIDO' && m.comentarioPastor && (
                  <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-3 text-xs text-red-300">
                    <p className="font-semibold mb-1">Comentário do pastor:</p>
                    <p>{m.comentarioPastor}</p>
                  </div>
                )}
                {m.status === 'DEVOLVIDO' && (
                  <button
                    onClick={() => reenviarMidia(m.id)}
                    disabled={carregando}
                    className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg py-1.5 transition-colors"
                  >
                    Corrigir e Reenviar para Aprovação
                  </button>
                )}
                {m.youtubeUrl && (
                  <a href={m.youtubeUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-400 underline">
                    Ver vídeo no YouTube
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ABA: Calendário */}
        {aba === 'calendario' && (
          <div className="space-y-4">
            <form onSubmit={salvarEvento} className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-3">
              <h2 className="font-semibold text-slate-200">{eventoId ? 'Editar Evento' : 'Novo Evento'}</h2>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Tipo</label>
                <select
                  value={eventoTipo}
                  onChange={e => setEventoTipo(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100"
                >
                  <option value="CULTO">Culto</option>
                  <option value="CONFERENCIA">Conferência</option>
                  <option value="REUNIAO">Reunião</option>
                  <option value="DATA_ESPECIAL">Data Especial</option>
                  <option value="OUTRO">Outro</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Título *</label>
                <input
                  type="text"
                  value={eventoTitulo}
                  onChange={e => setEventoTitulo(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100"
                  placeholder="Nome do evento"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Descrição</label>
                <textarea
                  value={eventoDesc}
                  onChange={e => setEventoDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 resize-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Local</label>
                <input
                  type="text"
                  value={eventoLocal}
                  onChange={e => setEventoLocal(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100"
                  placeholder="Ex.: Templo principal, Online..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Início *</label>
                  <input
                    type="datetime-local"
                    value={eventoInicio}
                    onChange={e => setEventoInicio(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Fim</label>
                  <input
                    type="datetime-local"
                    value={eventoFim}
                    onChange={e => setEventoFim(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={carregando}
                  className="flex-1 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold rounded-lg py-2 text-sm transition-colors"
                >
                  {carregando ? 'Salvando...' : (eventoId ? 'Atualizar' : 'Criar Evento')}
                </button>
                {eventoId && (
                  <button type="button" onClick={limparEvento} className="px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm">
                    Cancelar
                  </button>
                )}
              </div>
            </form>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-300">Próximos Eventos</h3>
              {carregando && <p className="text-slate-400 text-sm text-center">Carregando...</p>}
              {!carregando && eventos.length === 0 && (
                <p className="text-slate-500 text-sm text-center py-6">Nenhum evento cadastrado.</p>
              )}
              {eventos.map(ev => (
                <div key={ev.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-100 text-sm">{ev.titulo}</p>
                    <p className="text-xs text-slate-500">
                      {ev.tipo} · {new Date(ev.dataInicio).toLocaleString('pt-BR')}
                      {ev.local ? ` · 📍 ${ev.local}` : ''}
                    </p>
                    {ev.descricao && <p className="text-xs text-slate-400 mt-0.5">{ev.descricao}</p>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => editarEvento(ev)}
                      className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-1 rounded"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => excluirEvento(ev.id)}
                      className="text-xs bg-red-800/60 hover:bg-red-700/60 text-red-300 px-2 py-1 rounded"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ABA: Visual */}
        {aba === 'visual' && (
          <form onSubmit={salvarVisual} className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-slate-200">Personalização Visual</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Cor Primária</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={corPrimaria}
                    onChange={e => setCorPrimaria(e.target.value)}
                    className="w-10 h-10 rounded border border-slate-600 cursor-pointer"
                  />
                  <span className="text-xs text-slate-300 font-mono">{corPrimaria}</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Cor Secundária</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={corSecundaria}
                    onChange={e => setCorSecundaria(e.target.value)}
                    className="w-10 h-10 rounded border border-slate-600 cursor-pointer"
                  />
                  <span className="text-xs text-slate-300 font-mono">{corSecundaria}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Layout das telas de divulgação</label>
              <select
                value={layoutOpt}
                onChange={e => setLayoutOpt(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100"
              >
                <option value="GRID">Grade</option>
                <option value="CARROSSEL">Carrossel</option>
                <option value="LISTA">Lista</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Logo da Igreja</label>
              {visual?.logoUrl && (
                <img src={visual.logoUrl} alt="Logo atual" className="h-14 mb-2 rounded" />
              )}
              <input
                ref={logoRef}
                type="file"
                accept="image/*"
                onChange={e => setLogoFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-slate-300"
              />
            </div>

            {/* Preview das cores */}
            <div className="rounded-lg overflow-hidden border border-slate-600">
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
              className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold rounded-lg py-2 text-sm transition-colors"
            >
              {carregando ? 'Salvando...' : 'Salvar Configurações Visuais'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

