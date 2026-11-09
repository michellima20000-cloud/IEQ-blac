import React, { useState, useEffect, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Megaphone, Upload, ClipboardList, Calendar, Palette, ImagePlus,
  Check, Inbox, MapPin, Pencil, Trash2, RotateCcw, Youtube,
  CircleCheck, TriangleAlert, X, Download, Layout, Monitor,
  Image as ImageIcon, LayoutGrid, GalleryHorizontalEnd, List
} from 'lucide-react';
import { api, ApiClient } from '../api/client';

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

const CORES_PRIMARIA = ['#2563eb', '#4f46e5', '#7c3aed', '#0ea5e9', '#059669', '#16a34a', '#dc2626', '#db2777'];
const CORES_SECUNDARIA = ['#f59e0b', '#fbbf24', '#f97316', '#22d3ee', '#84cc16', '#e879f9', '#38bdf8', '#eab308'];
const LAYOUT_OPCOES: { value: string; label: string; desc: string; icon: LucideIcon }[] = [
  { value: 'GRID', label: 'Grade', desc: 'Blocos em colunas', icon: LayoutGrid },
  { value: 'CARROSSEL', label: 'Carrossel', desc: 'Deslize horizontal', icon: GalleryHorizontalEnd },
  { value: 'LISTA', label: 'Lista', desc: 'Um abaixo do outro', icon: List }
];

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

function redimensionarImagem(file: File, maxWidth = 1920, qualidade = 0.85): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let largura = img.width;
      let altura = img.height;
      if (largura <= maxWidth) {
        resolve(file);
        return;
      }
      altura = Math.round((altura * maxWidth) / largura);
      largura = maxWidth;
      const canvas = document.createElement('canvas');
      canvas.width = largura;
      canvas.height = altura;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, largura, altura);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          const nome = file.name.replace(/\.[^/.]+$/, '.jpg');
          const novoArquivo = new File([blob], nome, { type: 'image/jpeg', lastModified: Date.now() });
          resolve(novoArquivo);
        },
        'image/jpeg',
        qualidade
      );
    };
    img.onerror = () => reject(new Error('Falha ao processar a imagem.'));
    img.src = URL.createObjectURL(file);
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

  const [editMidiaId, setEditMidiaId] = useState<string | null>(null);
  const [editTitulo, setEditTitulo] = useState('');
  const [editDescricao, setEditDescricao] = useState('');
  const [editErro, setEditErro] = useState<string | null>(null);

  const [uploadTipo, setUploadTipo] = useState<'BANNER' | 'FOTO' | 'AVISO' | 'VIDEO'>('BANNER');
  const [uploadTitulo, setUploadTitulo] = useState('');
  const [uploadDescricao, setUploadDescricao] = useState('');
  const [uploadArquivo, setUploadArquivo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [arquivoInfo, setArquivoInfo] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadYoutube, setUploadYoutube] = useState('');
  const [uploadRequerAprovacao, setUploadRequerAprovacao] = useState(false);
  const [uploadErros, setUploadErros] = useState<Record<string, string>>({});

  const [eventoId, setEventoId] = useState<string | null>(null);
  const [eventoTitulo, setEventoTitulo] = useState('');
  const [eventoDesc, setEventoDesc] = useState('');
  const [eventoInicio, setEventoInicio] = useState('');
  const [eventoFim, setEventoFim] = useState('');
  const [eventoTipo, setEventoTipo] = useState('CULTO');
  const [eventoLocal, setEventoLocal] = useState('');
  const [eventoErros, setEventoErros] = useState<Record<string, string>>({});

  const [corPrimaria, setCorPrimaria] = useState('#2563eb');
  const [corSecundaria, setCorSecundaria] = useState('#f59e0b');
  const [layoutOpt, setLayoutOpt] = useState('GRID');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const appInstalado =
    typeof window !== 'undefined' &&
    window.matchMedia('(display-mode: standalone)').matches;

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!appInstalado) setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setShowInstallBanner(false);
      setDeferredPrompt(null);
    });
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', () => {});
    };
  }, [appInstalado]);

  const instalarApp = () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((resultado: any) => {
      if (resultado.outcome === 'accepted') {
        setShowInstallBanner(false);
        setDeferredPrompt(null);
      }
    });
  };

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
    setUploadErros({});

    let valido = true;
    const erros: Record<string, string> = {};

    if (!uploadTitulo.trim()) {
      erros.titulo = 'Informe o título.';
      valido = false;
    }
    if (uploadTipo === 'VIDEO' && !uploadYoutube && !uploadArquivo) {
      erros.video = 'Informe o link do YouTube ou selecione um arquivo de vídeo (máx. 50 MB).';
      valido = false;
    }
    if ((uploadTipo === 'BANNER' || uploadTipo === 'FOTO') && !uploadArquivo) {
      erros.arquivo = 'Selecione um arquivo de imagem.';
      valido = false;
    }
    if (uploadArquivo && uploadArquivo.size > 50 * 1024 * 1024) {
      erros.arquivo = 'O arquivo excede o limite de 50 MB.';
      valido = false;
    }

    setUploadErros(erros);
    if (!valido) return;

    const token = ApiClient.getAccessToken();
    if (!token) { setErro('Sessão expirada. Faça login novamente.'); return; }

    let arquivoParaEnvio = uploadArquivo;
    if ((uploadTipo === 'BANNER' || uploadTipo === 'FOTO') && uploadArquivo?.type.startsWith('image/')) {
      try {
        arquivoParaEnvio = await redimensionarImagem(uploadArquivo, 1920, 0.85);
      } catch {
        // segue com o arquivo original se o processamento falhar
      }
    }

    const fd = new FormData();
    fd.append('tipo', uploadTipo);
    fd.append('titulo', uploadTitulo);
    if (uploadDescricao) fd.append('descricao', uploadDescricao);
    if (uploadYoutube) fd.append('videoUrl', uploadYoutube);
    fd.append('precisaAprovacao', String(uploadRequerAprovacao));
    if (arquivoParaEnvio) fd.append('arquivo', arquivoParaEnvio);

    const UPLOAD_TIMEOUT_MS = 180_000;
    setCarregando(true);
    setUploadProgress(0);

    try {
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const tempoLimite = setTimeout(() => {
          xhr.abort();
          reject(new Error('O upload demorou mais que 3 minutos. Tente um arquivo menor ou verifique sua conexão.'));
        }, UPLOAD_TIMEOUT_MS);

        xhr.upload.addEventListener('progress', (ev) => {
          if (ev.lengthComputable) {
            setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
          }
        });

        xhr.addEventListener('load', () => {
          clearTimeout(tempoLimite);
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.responseText);
          } else {
            let mensagem = 'Erro ao enviar a mídia.';
            try { mensagem = JSON.parse(xhr.responseText)?.message || mensagem; } catch { /* ignora */ }
            reject(new Error(mensagem));
          }
        });

        xhr.addEventListener('error', () => {
          clearTimeout(tempoLimite);
          reject(new Error('Falha de conexão ao enviar a mídia. Verifique sua internet.'));
        });

        xhr.addEventListener('abort', () => {
          clearTimeout(tempoLimite);
          reject(new Error('Upload cancelado.'));
        });

        xhr.open('POST', `${ApiClient['getBaseUrl']()}/midia`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(fd);
      });

      setSucesso('Mídia enviada com sucesso!');
      setUploadTitulo(''); setUploadDescricao(''); setUploadYoutube('');
      setUploadArquivo(null); setPreviewUrl(null); setArquivoInfo(null); setUploadProgress(0);
      setUploadErros({});
      if (fileRef.current) fileRef.current.value = '';
      await carregarMidias();
    } catch (err: any) {
      setUploadProgress(0);
      setErro(msgErro(err, 'Falha ao enviar a mídia. Verifique sua conexão e tente novamente.'));
    } finally {
      setCarregando(false);
      setUploadProgress(0);
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

  async function salvarEdicaoMidia(e: React.FormEvent) {
    e.preventDefault();
    limparMsg();
    setEditErro(null);
    if (!editMidiaId) return;
    if (!editTitulo.trim()) { setEditErro('Informe o título.'); return; }
    setCarregando(true);
    try {
      await api.patch(`/midia/${editMidiaId}`, { titulo: editTitulo, descricao: editDescricao || null });
      setSucesso('Mídia atualizada.');
      setEditMidiaId(null);
      setEditTitulo('');
      setEditDescricao('');
      await carregarMidias();
    } catch (err: any) {
      setEditErro(msgErro(err, 'Erro ao atualizar mídia.'));
    } finally {
      setCarregando(false);
    }
  }

  async function excluirMidia(id: string) {
    if (!window.confirm('Excluir esta mídia?')) return;
    limparMsg();
    setCarregando(true);
    try {
      await api.delete(`/midia/${id}`);
      setSucesso('Mídia excluída.');
      // Remove imediatamente da lista local para sumir na UI sem esperar o recarregamento
      setMidias(prev => prev.filter(m => m.id !== id));
      await carregarMidias();
    } catch (err: any) {
      setErro(msgErro(err, 'Erro ao excluir mídia.'));
    } finally {
      setCarregando(false);
    }
  }

  function editarMidia(m: MediaItem) {
    setEditMidiaId(m.id);
    setEditTitulo(m.titulo);
    setEditDescricao(m.descricao ?? '');
    setEditErro(null);
  }

  function cancelarEdicaoMidia() {
    setEditMidiaId(null);
    setEditTitulo('');
    setEditDescricao('');
    setEditErro(null);
  }

  async function salvarEvento(e: React.FormEvent) {
    e.preventDefault();
    limparMsg();
    setEventoErros({});
    let valido = true;
    const erros: Record<string, string> = {};
    if (!eventoTitulo.trim()) { erros.titulo = 'Preencha o título.'; valido = false; }
    if (!eventoInicio) { erros.inicio = 'Preencha a data de início.'; valido = false; }
    setEventoErros(erros);
    if (!valido) return;
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
    setEventoErros({});
  }

  function limparEvento() {
    setEventoId(null); setEventoTitulo(''); setEventoDesc('');
    setEventoInicio(''); setEventoFim(''); setEventoTipo('CULTO'); setEventoLocal('');
    setEventoErros({});
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

  function InputErro({ id, mensagem }: { id: string; mensagem: string }) {
    return (
      <p id={id} className="text-[11px] text-red-400 mt-1" role="alert" aria-live="polite">
        {mensagem}
      </p>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5 safe-bottom">
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

      {showInstallBanner && !appInstalado && (
        <div className="flex justify-end">
          <button
            onClick={instalarApp}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 rounded text-xs text-blue-400"
            aria-label="Instalar aplicativo"
          >
            <Download size={14} className="shrink-0" />
            Instalar app
          </button>
        </div>
      )}

      <nav className="flex flex-wrap gap-2" aria-label="Abas da área de mídia">
        {abas.map(a => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            aria-pressed={aba === a.id}
            className={`tab flex items-center gap-1.5 ${aba === a.id ? 'tab-active' : ''}`}
          >
            <a.Icon size={14} />
            {a.label}
          </button>
        ))}
      </nav>

      {erro && (
        <div className="alert-error" role="alert">
          <span className="flex items-center gap-2 min-w-0">
            <TriangleAlert size={15} className="shrink-0" />
            <span>{erro}</span>
          </span>
          <button onClick={limparMsg} aria-label="Fechar aviso" className="shrink-0 text-red-400/70 hover:text-red-300 transition-colors">
            <X size={15} />
          </button>
        </div>
      )}
      {sucesso && (
        <div className="alert-success" role="status" aria-live="polite">
          <span className="flex items-center gap-2 min-w-0">
            <CircleCheck size={15} className="shrink-0" />
            <span>{sucesso}</span>
          </span>
          <button onClick={limparMsg} aria-label="Fechar confirmação" className="shrink-0 text-emerald-400/70 hover:text-emerald-300 transition-colors">
            <X size={15} />
          </button>
        </div>
      )}

      <div key={aba} className="anim-fade-up">
      {aba === 'uploads' && (
        <form onSubmit={enviarMidia} className="card card-pad space-y-4" aria-label="Enviar nova mídia">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <ImagePlus size={15} />
            </span>
            <h2 className="section-title">Nova Mídia</h2>
          </div>

          <div>
            <label className="label" htmlFor="upload-tipo">Tipo</label>
            <select
              id="upload-tipo"
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
            <label className="label" htmlFor="upload-titulo">Título <span className="text-red-500" aria-hidden="true">*</span></label>
            <input
              id="upload-titulo"
              type="text"
              value={uploadTitulo}
              onChange={e => setUploadTitulo(e.target.value)}
              className={`input ${uploadErros.titulo ? 'border-red-500/50 focus:border-red-500' : ''}`}
              placeholder="Título da mídia"
              aria-required="true"
              aria-invalid={!!uploadErros.titulo}
              aria-describedby={uploadErros.titulo ? 'erro-upload-titulo' : undefined}
            />
            {uploadErros.titulo && <InputErro id="erro-upload-titulo" mensagem={uploadErros.titulo} />}
          </div>

          <div>
            <label className="label" htmlFor="upload-descricao">Descrição</label>
            <textarea
              id="upload-descricao"
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
                <label className="label" htmlFor="upload-youtube">Link do YouTube (não listado)</label>
                <input
                  id="upload-youtube"
                  type="url"
                  value={uploadYoutube}
                  onChange={e => setUploadYoutube(e.target.value)}
                  className={`input ${uploadErros.video ? 'border-red-500/50 focus:border-red-500' : ''}`}
                  placeholder="https://www.youtube.com/watch?v=..."
                  aria-invalid={!!uploadErros.video}
                  aria-describedby={uploadErros.video ? 'erro-upload-video' : undefined}
                />
                {uploadErros.video && <InputErro id="erro-upload-video" mensagem={uploadErros.video} />}
              </div>
              <p className="text-xs text-slate-500 text-center">— ou —</p>
              <div>
                <label className="label" htmlFor="upload-video-arquivo">Arquivo de vídeo (máx. 50 MB)</label>
                <input
                  id="upload-video-arquivo"
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
              <label className="label" htmlFor="upload-imagem">Arquivo (imagem)</label>
              <div className="relative">
                <input
                  id="upload-imagem"
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0] ?? null;
                    setUploadArquivo(file);
                    setUploadErros(prev => { const next = { ...prev }; delete next.arquivo; return next; });
                    if (!file) { setPreviewUrl(null); setArquivoInfo(null); return; }
                    setPreviewUrl(URL.createObjectURL(file));
                    const img = new Image();
                    img.src = URL.createObjectURL(file);
                    img.onload = () => {
                      const kb = Math.round(file.size / 1024);
                      setArquivoInfo(`${img.width} × ${img.height} • ${kb} KB`);
                      URL.revokeObjectURL(img.src);
                    };
                  }}
                  className="input sr-only peer"
                  aria-label="Selecionar imagem"
                />
                <label
                  htmlFor="upload-imagem"
                  className="flex items-center gap-2 w-full cursor-pointer rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-2.5 text-sm text-slate-300 hover:border-blue-500/60 hover:bg-slate-900 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500/50"
                >
                  <ImagePlus size={14} className="shrink-0 text-blue-400" />
                  <span>{uploadArquivo ? uploadArquivo.name : 'Escolher arquivo'}</span>
                  {!uploadArquivo && (
                    <span className="ml-auto text-xs text-slate-500">Nenhum arquivo escolhido</span>
                  )}
                </label>
                {uploadErros.arquivo && <InputErro id="erro-upload-arquivo" mensagem={uploadErros.arquivo} />}
              </div>
              {previewUrl && (
                <div className="mt-2 relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950">
                  <img src={previewUrl} alt="Pré-visualização da imagem" className="w-full h-48 object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setUploadArquivo(null); setPreviewUrl(null); setArquivoInfo(null);
                      setUploadErros(prev => { const next = { ...prev }; delete next.arquivo; return next; });
                      if (fileRef.current) fileRef.current.value = '';
                    }}
                    className="absolute top-2 right-2 bg-black/60 hover:bg-black/90 text-white rounded-full w-7 h-7 flex items-center justify-center"
                    aria-label="Remover imagem"
                  >
                    <X size={14} />
                  </button>
                  {arquivoInfo && (
                    <div className="absolute bottom-2 left-2 bg-black/60 text-[11px] text-slate-300 px-2 py-1 rounded">
                      {arquivoInfo}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <label className="card-soft card-hover px-3.5 py-3 flex items-center gap-2.5 cursor-pointer" htmlFor="upload-aprovacao">
            <input
              id="upload-aprovacao"
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

          {uploadProgress > 0 && (
            <div className="mt-3">
              <div className="progress-track" role="progressbar" aria-valuenow={uploadProgress} aria-valuemin={0} aria-valuemax={100}>
                <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                <span>Enviando arquivo...</span>
                <span>{uploadProgress}%</span>
              </div>
            </div>
          )}
        </form>
      )}

      {aba === 'status' && (
        <section className="card card-pad" aria-label="Minhas mídias">
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
              <div className="w-7 h-7 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              <span className="sr-only">Carregando mídias...</span>
              Carregando...
            </div>
          )}
          {!carregando && midias.length === 0 && (
            <div className="empty-state border-0 bg-transparent p-8">
              <Inbox size={22} className="block mx-auto mb-2 text-slate-600" aria-hidden="true" />
              Nenhuma mídia enviada ainda.
            </div>
          )}

          <div className="space-y-3">
            {midias.map(m => {
              const editando = editMidiaId === m.id;
              return (
                <div key={m.id} className="card-soft card-hover p-4 space-y-2">
                  {editando ? (
                    <form onSubmit={salvarEdicaoMidia} className="space-y-3" aria-label={`Editar ${m.titulo}`}>
                      <div>
                        <label className="label" htmlFor={`edit-titulo-${m.id}`}>Título</label>
                        <input
                          id={`edit-titulo-${m.id}`}
                          type="text"
                          value={editTitulo}
                          onChange={e => setEditTitulo(e.target.value)}
                          className={`input ${editErro ? 'border-red-500/50 focus:border-red-500' : ''}`}
                          autoFocus
                          aria-invalid={!!editErro}
                          aria-describedby={editErro ? `erro-edit-${m.id}` : undefined}
                        />
                        {editErro && <InputErro id={`erro-edit-${m.id}`} mensagem={editErro} />}
                      </div>
                      <div>
                        <label className="label" htmlFor={`edit-descricao-${m.id}`}>Descrição</label>
                        <textarea
                          id={`edit-descricao-${m.id}`}
                          value={editDescricao}
                          onChange={e => setEditDescricao(e.target.value)}
                          rows={2}
                          className="input resize-none"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button type="submit" disabled={carregando} className="btn-primary flex-1">
                          <Check size={14} />
                          Salvar
                        </button>
                        <button type="button" onClick={cancelarEdicaoMidia} className="btn-ghost flex-1">
                          Cancelar
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white">{m.titulo}</p>
                          <p className="text-xs text-slate-400 mt-1">{m.tipo} · {new Date(m.criadoEm).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={STATUS_COR[m.status]}>
                            {STATUS_LABEL[m.status]}
                          </span>
                          <button
                            onClick={() => editarMidia(m)}
                            disabled={carregando}
                            className="btn-ghost btn-sm"
                            title="Editar"
                            aria-label={`Editar ${m.titulo}`}
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => excluirMidia(m.id)}
                            disabled={carregando}
                            className="btn-soft-danger btn-sm"
                            title="Excluir"
                            aria-label={`Excluir ${m.titulo}`}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      {m.status === 'DEVOLVIDO' && m.comentarioPastor && (
                        <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-300" role="alert">
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
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {aba === 'calendario' && (
        <div className="space-y-5">
          <form onSubmit={salvarEvento} className="card card-pad space-y-4" aria-label={eventoId ? 'Editar evento' : 'Novo evento'}>
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Calendar size={15} />
              </span>
              <h2 className="section-title">{eventoId ? 'Editar Evento' : 'Novo Evento'}</h2>
            </div>

            <div>
              <label className="label" htmlFor="evento-tipo">Tipo</label>
              <select
                id="evento-tipo"
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
              <label className="label" htmlFor="evento-titulo">Título <span className="text-red-500" aria-hidden="true">*</span></label>
              <input
                id="evento-titulo"
                type="text"
                value={eventoTitulo}
                onChange={e => setEventoTitulo(e.target.value)}
                className={`input ${eventoErros.titulo ? 'border-red-500/50 focus:border-red-500' : ''}`}
                placeholder="Nome do evento"
                aria-required="true"
                aria-invalid={!!eventoErros.titulo}
                aria-describedby={eventoErros.titulo ? 'erro-evento-titulo' : undefined}
              />
              {eventoErros.titulo && <InputErro id="erro-evento-titulo" mensagem={eventoErros.titulo} />}
            </div>

            <div>
              <label className="label" htmlFor="evento-descricao">Descrição</label>
              <textarea
                id="evento-descricao"
                value={eventoDesc}
                onChange={e => setEventoDesc(e.target.value)}
                rows={2}
                className="input resize-none"
              />
            </div>

            <div>
              <label className="label" htmlFor="evento-local">Local</label>
              <input
                id="evento-local"
                type="text"
                value={eventoLocal}
                onChange={e => setEventoLocal(e.target.value)}
                className="input"
                placeholder="Ex.: Templo principal, Online..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="evento-inicio">Início <span className="text-red-500" aria-hidden="true">*</span></label>
                <input
                  id="evento-inicio"
                  type="datetime-local"
                  value={eventoInicio}
                  onChange={e => setEventoInicio(e.target.value)}
                  className={`input ${eventoErros.inicio ? 'border-red-500/50 focus:border-red-500' : ''}`}
                  aria-required="true"
                  aria-invalid={!!eventoErros.inicio}
                  aria-describedby={eventoErros.inicio ? 'erro-evento-inicio' : undefined}
                />
                {eventoErros.inicio && <InputErro id="erro-evento-inicio" mensagem={eventoErros.inicio} />}
              </div>
              <div>
                <label className="label" htmlFor="evento-fim">Fim</label>
                <input
                  id="evento-fim"
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

          <section className="card card-pad" aria-label="Próximos eventos">
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
                <div className="w-7 h-7 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                <span className="sr-only">Carregando eventos...</span>
                Carregando...
              </div>
            )}
            {!carregando && eventos.length === 0 && (
              <div className="empty-state border-0 bg-transparent p-8">
                <Calendar size={22} className="block mx-auto mb-2 text-slate-600" aria-hidden="true" />
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
                      aria-label={`Editar evento ${ev.titulo}`}
                    >
                      <Pencil size={12} />
                      Editar
                    </button>
                    <button
                      onClick={() => excluirEvento(ev.id)}
                      className="btn-soft-danger btn-sm"
                      aria-label={`Excluir evento ${ev.titulo}`}
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

      {aba === 'visual' && (
        <form onSubmit={salvarVisual} className="space-y-6" aria-label="Configurações visuais">
          <div className="card card-pad">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <Palette size={16} />
              </span>
              <h2 className="section-title">Personalização Visual</h2>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Personalize as cores e identidade visual da sua igreja.
            </p>
          </div>

          <div className="card card-pad">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {([
                { id: 'visual-cor-primaria', label: 'Cor Primária', value: corPrimaria, setValue: setCorPrimaria, paleta: CORES_PRIMARIA },
                { id: 'visual-cor-secundaria', label: 'Cor Secundária', value: corSecundaria, setValue: setCorSecundaria, paleta: CORES_SECUNDARIA }
              ] as const).map((campo) => (
                <div key={campo.id} className="space-y-3">
                  <label className="label flex items-center gap-2" htmlFor={campo.id}>
                    <span className="w-3 h-3 rounded-full ring-2 ring-white/10" style={{ backgroundColor: campo.value }} />
                    {campo.label}
                  </label>
                  <div className="flex items-center gap-3">
                    <label
                      className="relative w-11 h-11 rounded-xl cursor-pointer shrink-0 border border-white/10 hover:scale-105 transition-transform"
                      style={{ backgroundColor: campo.value, boxShadow: `0 6px 18px -6px ${campo.value}` }}
                      title="Abrir seletor de cor"
                    >
                      <input
                        id={campo.id}
                        type="color"
                        value={campo.value}
                        onChange={e => campo.setValue(e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        aria-label={`Selecionar ${campo.label.toLowerCase()}`}
                      />
                    </label>
                    <code className="text-xs font-mono text-slate-200 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700">
                      {campo.value}
                    </code>
                  </div>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Paletas rápidas — ${campo.label}`}>
                    {campo.paleta.map((cor) => (
                      <button
                        key={cor}
                        type="button"
                        onClick={() => campo.setValue(cor)}
                        aria-pressed={campo.value.toLowerCase() === cor}
                        title={cor}
                        className={`w-7 h-7 rounded-lg border border-white/10 hover:scale-110 transition-transform ${campo.value.toLowerCase() === cor ? 'ring-2 ring-white/70 ring-offset-2 ring-offset-slate-900' : ''}`}
                        style={{ backgroundColor: cor }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div
              className="mt-5 h-3 rounded-full"
              style={{ backgroundImage: `linear-gradient(90deg, ${corPrimaria}, ${corSecundaria})` }}
              aria-hidden="true"
            />
          </div>

          <div className="card card-pad">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0 text-indigo-400">
                <Layout size={16} />
              </span>
              <h3 className="text-sm font-semibold text-slate-300">Layout das telas de divulgação</h3>
            </div>
            <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Layout de divulgação">
              {LAYOUT_OPCOES.map((opt) => {
                const Icone = opt.icon;
                const ativo = layoutOpt === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setLayoutOpt(opt.value)}
                    aria-pressed={ativo}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-4 text-center transition-all ${
                      ativo
                        ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-600/20'
                        : 'border-slate-700 bg-slate-950/60 hover:border-slate-500 hover:bg-slate-900'
                    }`}
                  >
                    <Icone size={20} className={ativo ? 'text-blue-400' : 'text-slate-400'} />
                    <span className={`text-xs font-semibold ${ativo ? 'text-white' : 'text-slate-300'}`}>{opt.label}</span>
                    <span className="text-[10px] leading-tight text-slate-500">{opt.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card card-pad">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-3 h-3 rounded-full text-emerald-400">
                <ImageIcon size={12} />
              </span>
              <label className="label flex items-center gap-2" htmlFor="visual-logo">
                Logo da Igreja
              </label>
            </div>
            <div className="space-y-3">
              {visual?.logoUrl && (
                <div className="flex items-center gap-3">
                  <img
                    src={visual.logoUrl}
                    alt="Logo atual da igreja"
                    className="h-16 w-auto rounded-xl border border-slate-700/70 shadow-lg"
                  />
                  <span className="text-xs text-slate-400 font-mono bg-slate-800/80 px-2 py-1 rounded border border-slate-700 truncate max-w-xs">
                    {visual.logoUrl.length > 60 ? visual.logoUrl.slice(0, 57) + '...' : visual.logoUrl}
                  </span>
                </div>
              )}
              <input
                id="visual-logo"
                ref={logoRef}
                type="file"
                accept="image/*"
                onChange={e => setLogoFile(e.target.files?.[0] ?? null)}
                className="input sr-only peer"
                aria-label="Enviar logo da igreja"
              />
              <label
                htmlFor="visual-logo"
                className="flex items-center gap-2 w-full cursor-pointer rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-2.5 text-sm text-slate-300 hover:border-blue-500/60 hover:bg-slate-900 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500/50"
              >
                <ImageIcon size={14} className="shrink-0 text-blue-400" />
                <span className="truncate">{logoFile ? logoFile.name : 'Selecionar nova logo (PNG/JPG/SVG)'}</span>
                {!logoFile && (
                  <span className="ml-auto text-xs text-slate-500 shrink-0">Nenhuma imagem escolhida</span>
                )}
              </label>
            </div>
          </div>

          <div className="card card-pad">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 text-blue-400">
                <Monitor size={16} />
              </span>
              <h3 className="text-sm font-semibold text-slate-300">Pré-visualização</h3>
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-700/70 shadow-xl">
              <div
                className="p-4 flex items-center justify-center gap-3 text-white text-sm font-semibold"
                style={{ backgroundColor: corPrimaria }}
              >
                {visual?.logoUrl && (
                  <img
                    src={visual.logoUrl}
                    alt="Logo"
                    className="w-7 h-7 rounded-lg object-contain bg-white/10 p-0.5"
                  />
                )}
                Cabeçalho da Igreja
              </div>
              <div
                className="p-6 text-slate-300 text-sm text-center border-t-2"
                style={{ backgroundColor: '#0f172a', borderColor: corSecundaria }}
              >
                Área de conteúdo • Layout {layoutOpt === 'GRID' ? 'Grade' : layoutOpt === 'CARROSSEL' ? 'Carrossel' : 'Lista'}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="btn-primary w-full py-4 text-base font-semibold shadow-lg hover:shadow-indigo-500/30 transition-all mb-4"
          >
            <Check size={16} />
            {carregando ? 'Salvando...' : 'Salvar Configurações Visuais'}
          </button>
        </form>
      )}
      </div>
    </div>
  );
}
