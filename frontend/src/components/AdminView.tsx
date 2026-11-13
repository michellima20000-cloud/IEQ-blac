import React, { useEffect, useMemo, useState } from 'react';
import {
  Shield, Building2, Users, FileText, RefreshCw, Plus, Pencil, Trash2, X,
  Server, HardDrive, CheckCircle2, AlertTriangle
} from 'lucide-react';
import { ApiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { SkeletonPage } from './Skeleton';

type Aba = 'sistema' | 'usuarios' | 'auditoria';

const perfis = ['CELULA', 'REDE', 'PASTOR', 'MIDIA', 'ADM'] as const;

export const AdminView: React.FC = () => {
  const { usuario } = useAuth();
  const [aba, setAba] = useState<Aba>('sistema');
  const [resumo, setResumo] = useState<any>(null);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [auditoria, setAuditoria] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [filtroIgreja, setFiltroIgreja] = useState('');
  const [filtroPerfil, setFiltroPerfil] = useState('');
  const [busca, setBusca] = useState('');

  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [form, setForm] = useState({
    igrejaId: '',
    nome: '',
    email: '',
    senha: '',
    perfil: 'PASTOR' as string,
    ativo: true,
  });

  const igrejas = resumo?.igrejas ?? [];

  async function carregarSistema() {
    const dados = await ApiClient.get('/admin/sistema');
    setResumo(dados);
  }

  async function carregarUsuarios() {
    const params: any = {};
    if (filtroIgreja) params.igrejaId = filtroIgreja;
    if (filtroPerfil) params.perfil = filtroPerfil;
    const dados = await ApiClient.get('/admin/usuarios', params);
    setUsuarios(Array.isArray(dados) ? dados : []);
  }

  async function carregarAuditoria() {
    const dados = await ApiClient.get('/admin/auditoria', { limite: 150 });
    setAuditoria(Array.isArray(dados) ? dados : []);
  }

  async function carregarTudo() {
    setCarregando(true);
    setErro(null);
    try {
      await carregarSistema();
      if (aba === 'usuarios') await carregarUsuarios();
      if (aba === 'auditoria') await carregarAuditoria();
    } catch (e: any) {
      setErro(e.message || 'Falha ao carregar dados do painel ADM.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregarTudo(); /* eslint-disable-next-line */ }, []);

  useEffect(() => {
    if (!resumo) return;
    if (aba === 'usuarios') carregarUsuarios().catch((e) => setErro(e.message));
    if (aba === 'auditoria') carregarAuditoria().catch((e) => setErro(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba]);

  useEffect(() => {
    if (aba === 'usuarios' && resumo) carregarUsuarios().catch((e) => setErro(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroIgreja, filtroPerfil]);

  const usuariosFiltrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return usuarios;
    return usuarios.filter((u) =>
      [u.nome, u.email, u.perfil, u.igreja?.nome, u.igreja?.slug].some((v) =>
        String(v || '').toLowerCase().includes(t)
      )
    );
  }, [usuarios, busca]);

  function abrirNovo() {
    setEditando(null);
    setForm({
      igrejaId: filtroIgreja || igrejas[0]?.id || '',
      nome: '',
      email: '',
      senha: '',
      perfil: 'PASTOR',
      ativo: true,
    });
    setModalAberto(true);
  }

  function abrirEdicao(u: any) {
    setEditando(u);
    setForm({
      igrejaId: u.igreja_id || u.igreja?.id || '',
      nome: u.nome || '',
      email: u.email || '',
      senha: '',
      perfil: u.perfil || 'PASTOR',
      ativo: u.ativo !== false,
    });
    setModalAberto(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      if (editando) {
        const payload: any = { nome: form.nome, email: form.email, perfil: form.perfil, ativo: form.ativo };
        if (form.senha) payload.senha = form.senha;
        await ApiClient.patch(`/admin/usuarios/${editando.id}`, payload);
        setAviso('Usuário atualizado.');
      } else {
        if (!form.igrejaId) throw new Error('Selecione a igreja.');
        await ApiClient.post('/admin/usuarios', {
          igrejaId: form.igrejaId,
          nome: form.nome,
          email: form.email,
          senha: form.senha,
          perfil: form.perfil,
        });
        setAviso('Usuário criado com sucesso.');
      }
      setModalAberto(false);
      await carregarUsuarios();
      await carregarSistema();
    } catch (e: any) {
      setErro(e?.response?.data?.message || e.message || 'Falha ao salvar usuário.');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(u: any) {
    if (!window.confirm(`Excluir o usuário "${u.nome}"? Se houver vínculos, ele será apenas desativado.`)) return;
    setExcluindoId(u.id);
    setErro(null);
    try {
      const res = await ApiClient.delete(`/admin/usuarios/${u.id}`);
      setAviso(res?.mensagem || 'Usuário removido/desativado.');
      await carregarUsuarios();
      await carregarSistema();
    } catch (e: any) {
      setErro(e?.response?.data?.message || e.message || 'Falha ao excluir usuário.');
    } finally {
      setExcluindoId(null);
    }
  }

  if (carregando && !resumo) return <SkeletonPage />;

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2"><Shield size={18} className="text-red-400" />Painel do Administrador</h2>
          <p className="text-xs text-slate-400">Acesso global a todas as igrejas e configurações do sistema.</p>
        </div>
        <button onClick={carregarTudo} className="btn-ghost btn-sm"><RefreshCw size={14} /> Atualizar</button>
      </div>

      {(erro || aviso) && (
        <div className={`card-soft p-3 text-sm flex items-start gap-2 ${erro ? 'text-red-300 border-red-500/30' : 'text-emerald-300 border-emerald-500/30'}`}>
          {erro ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          <span className="flex-1">{erro || aviso}</span>
          <button onClick={() => { setErro(null); setAviso(null); }} className="text-slate-400"><X size={14} /></button>
        </div>
      )}

      <div className="flex gap-2">
        {([
          { id: 'sistema', label: 'Sistema', Icon: Server },
          { id: 'usuarios', label: 'Usuários', Icon: Users },
          { id: 'auditoria', label: 'Auditoria', Icon: FileText },
        ] as const).map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setAba(id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition ${aba === id ? 'bg-red-500/15 text-red-300 border-red-500/30' : 'text-slate-400 border-slate-800 hover:text-white'}`}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {aba === 'sistema' && resumo && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { label: 'Igrejas', val: resumo.totais?.igrejas },
              { label: 'Usuários ativos', val: resumo.totais?.usuariosAtivos },
              { label: 'Células', val: resumo.totais?.celulas },
              { label: 'Relatórios', val: resumo.totais?.relatorios },
              { label: 'Mídias', val: resumo.totais?.midias },
            ].map((s) => (
              <div key={s.label} className="card-soft p-3">
                <div className="text-[10px] uppercase text-slate-400">{s.label}</div>
                <div className="text-xl font-bold text-white">{s.val ?? 0}</div>
              </div>
            ))}
          </div>

          <div className="card-soft p-4 space-y-2">
            <div className="text-sm font-semibold text-white flex items-center gap-2"><HardDrive size={15} /> Armazenamento & Backup</div>
            <div className="text-xs text-slate-300">Uso: <b>{resumo.armazenamento?.espacoUsadoFormatado || '—'}</b></div>
            <div className="text-xs text-slate-300">Backup: <b>{resumo.segurancaBackup?.status || 'desconhecido'}</b> {resumo.segurancaBackup?.ultimoBackupEm ? `• último: ${new Date(resumo.segurancaBackup.ultimoBackupEm).toLocaleString('pt-BR')}` : ''}</div>
            {resumo.segurancaBackup?.mensagem && <div className="text-xs text-slate-400">{resumo.segurancaBackup.mensagem}</div>}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold text-white flex items-center gap-2"><Building2 size={15} /> Igrejas ({igrejas.length})</div>
            {igrejas.map((ig: any) => (
              <div key={ig.id} className="card-soft p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{ig.nome}</div>
                  <div className="text-xs text-slate-400">slug: {ig.slug} • id: <span className="font-mono">{ig.id}</span></div>
                </div>
                <div className="text-[11px] text-slate-300 grid grid-cols-2 gap-x-3 gap-y-0.5 shrink-0">
                  <span>Usuários: <b>{ig._count?.usuarios ?? 0}</b></span>
                  <span>Células: <b>{ig._count?.celulas ?? 0}</b></span>
                  <span>Redes: <b>{ig._count?.redes ?? 0}</b></span>
                  <span>Relatórios: <b>{ig._count?.relatorios ?? 0}</b></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {aba === 'usuarios' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[140px]">
              <label className="label">Igreja</label>
              <select className="input" value={filtroIgreja} onChange={(e) => setFiltroIgreja(e.target.value)}>
                <option value="">Todas</option>
                {igrejas.map((ig: any) => <option key={ig.id} value={ig.id}>{ig.nome}</option>)}
              </select>
            </div>
            <div className="w-36">
              <label className="label">Perfil</label>
              <select className="input" value={filtroPerfil} onChange={(e) => setFiltroPerfil(e.target.value)}>
                <option value="">Todos</option>
                {perfis.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="label">Buscar</label>
              <input className="input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="nome, e-mail, igreja..." />
            </div>
            <button onClick={abrirNovo} className="btn-primary btn-sm"><Plus size={14} /> Novo</button>
          </div>

          <div className="text-xs text-slate-400">{usuariosFiltrados.length} usuário(s)</div>
          <div className="space-y-2">
            {usuariosFiltrados.map((u) => (
              <div key={u.id} className="card-soft p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{u.nome} {!u.ativo && <span className="text-amber-400 text-xs">(inativo)</span>}</div>
                  <div className="text-xs text-slate-400 truncate">{u.email}</div>
                  <div className="text-[11px] text-slate-500 flex flex-wrap gap-2 mt-0.5">
                    <span className="badge-indigo">{u.perfil}</span>
                    <span>{u.igreja?.nome || u.igreja_id}</span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => abrirEdicao(u)} className="btn-ghost btn-sm" title="Editar"><Pencil size={14} /></button>
                  <button onClick={() => excluir(u)} disabled={excluindoId === u.id || u.id === usuario?.id} className="btn-ghost btn-sm text-red-400" title="Excluir"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
            {usuariosFiltrados.length === 0 && <div className="text-sm text-slate-400 text-center py-6">Nenhum usuário encontrado.</div>}
          </div>
        </div>
      )}

      {aba === 'auditoria' && (
        <div className="space-y-2">
          <div className="text-xs text-slate-400">{auditoria.length} registro(s) recentes</div>
          {auditoria.map((log: any) => (
            <div key={log.id} className="card-soft p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-white">{log.acao || log.tipo || 'Evento'}</span>
                <span className="text-[11px] text-slate-500">{log.createdAt ? new Date(log.createdAt).toLocaleString('pt-BR') : ''}</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {log.usuario?.nome ? `${log.usuario.nome} (${log.usuario.perfil})` : '—'} • {log.igreja?.nome || log.igreja?.slug || '—'}
              </div>
              {(log.detalhes || log.descricao) && (
                <pre className="text-[11px] text-slate-300 mt-1 whitespace-pre-wrap break-words">{typeof (log.detalhes || log.descricao) === 'string' ? (log.detalhes || log.descricao) : JSON.stringify(log.detalhes || log.descricao, null, 2)}</pre>
              )}
            </div>
          ))}
          {auditoria.length === 0 && <div className="text-sm text-slate-400 text-center py-6">Sem registros de auditoria.</div>}
        </div>
      )}

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">{editando ? 'Editar usuário' : 'Novo usuário'}</h3>
              <button onClick={() => setModalAberto(false)} className="text-slate-400"><X size={16} /></button>
            </div>
            <form onSubmit={salvar} className="space-y-3">
              {!editando && (
                <div>
                  <label className="label">Igreja</label>
                  <select className="input" value={form.igrejaId} onChange={(e) => setForm({ ...form, igrejaId: e.target.value })} required>
                    <option value="">Selecione...</option>
                    {igrejas.map((ig: any) => <option key={ig.id} value={ig.id}>{ig.nome} ({ig.slug})</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="label">Nome</label>
                <input className="input" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
              </div>
              <div>
                <label className="label">E-mail</label>
                <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div>
                <label className="label">Senha {editando && <span className="text-slate-500">(deixe em branco para manter)</span>}</label>
                <input type="password" className="input" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} minLength={editando ? 0 : 6} required={!editando} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Perfil</label>
                  <select className="input" value={form.perfil} onChange={(e) => setForm({ ...form, perfil: e.target.value })}>
                    {perfis.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                {editando && (
                  <div>
                    <label className="label">Status</label>
                    <select className="input" value={form.ativo ? '1' : '0'} onChange={(e) => setForm({ ...form, ativo: e.target.value === '1' })}>
                      <option value="1">Ativo</option>
                      <option value="0">Inativo</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button type="button" onClick={() => setModalAberto(false)} className="btn-ghost btn-sm">Cancelar</button>
                <button type="submit" disabled={salvando} className="btn-primary btn-sm">{salvando ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminView;
