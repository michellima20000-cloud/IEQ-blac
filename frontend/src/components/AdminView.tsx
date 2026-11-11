import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard, Users, ScrollText, Church, ShieldAlert, HardDrive, Database,
  Pencil, Trash2, X, UserPlus, Search, Clock
} from 'lucide-react';
import { ApiClient } from '../api/client';
import { SkeletonPage } from './Skeleton';

const subAbas = [
  { id: 'sistema', label: 'Sistema', Icon: LayoutDashboard },
  { id: 'usuarios', label: 'Usuários', Icon: Users },
  { id: 'auditoria', label: 'Auditoria', Icon: ScrollText },
] as const;

const perfilLabels: Record<string, string> = {
  CELULA: 'Líder de Célula',
  REDE: 'Líder de Rede',
  PASTOR: 'Pastor',
  MIDIA: 'Mídia',
  ADM: 'Administrador'
};

export const AdminView: React.FC = () => {
  const [subAba, setSubAba] = useState<'sistema' | 'usuarios' | 'auditoria'>('sistema');

  const [carregando, setCarregando] = useState(true);
  const [sistema, setSistema] = useState<any | null>(null);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [auditoria, setAuditoria] = useState<any[]>([]);

  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);

  // Formulário de usuário
  const [usuarioEditandoId, setUsuarioEditandoId] = useState<string | null>(null);
  const [formUsuario, setFormUsuario] = useState({
    igrejaId: '',
    nome: '',
    email: '',
    senha: '',
    perfil: 'MIDIA' as 'CELULA' | 'REDE' | 'MIDIA' | 'PASTOR' | 'ADM',
    nomeRede: '',
    identificadorCelula: ''
  });
  const [busca, setBusca] = useState('');

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setCarregando(true);
    try {
      const [resSistema, resUsuarios, resAuditoria] = await Promise.all([
        ApiClient.get('/admin/sistema').catch(() => null),
        ApiClient.get('/admin/usuarios').catch(() => ({ usuarios: [] })),
        ApiClient.get('/admin/auditoria').catch(() => ({ auditoria: [] }))
      ]);
      setSistema(resSistema);
      setUsuarios(Array.isArray(resUsuarios) ? resUsuarios : resUsuarios.usuarios || []);
      setAuditoria(Array.isArray(resAuditoria) ? resAuditoria : resAuditoria.auditoria || []);
    } finally {
      setCarregando(false);
    }
  };

  const limparFormulario = () => {
    setUsuarioEditandoId(null);
    setFormUsuario((f) => ({ ...f, nome: '', email: '', senha: '', perfil: 'MIDIA', nomeRede: '', identificadorCelula: '' }));
  };

  const editarUsuario = (u: any) => {
    setUsuarioEditandoId(u.id);
    setFormUsuario((f) => ({
      ...f,
      igrejaId: u.igreja_id || u.igreja?.id || '',
      nome: u.nome || '',
      email: u.email || '',
      senha: '',
      perfil: u.perfil || 'MIDIA',
      nomeRede: u.rede?.nome || '',
      identificadorCelula: u.celula?.nome || ''
    }));
    setSubAba('usuarios');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const salvarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensagemErro(null);
    try {
      if (usuarioEditandoId) {
        await ApiClient.patch(`/admin/usuarios/${usuarioEditandoId}`, {
          nome: formUsuario.nome,
          email: formUsuario.email,
          perfil: formUsuario.perfil,
          ...(formUsuario.senha ? { senha: formUsuario.senha } : {})
        });
        setMensagemSucesso('Usuário atualizado com sucesso!');
      } else {
        await ApiClient.post('/admin/usuarios', {
          igrejaId: formUsuario.igrejaId || sistema?.igrejas?.[0]?.id,
          nome: formUsuario.nome,
          email: formUsuario.email,
          senha: formUsuario.senha,
          perfil: formUsuario.perfil,
          nomeRede: formUsuario.nomeRede || undefined,
          identificadorCelula: formUsuario.identificadorCelula || undefined
        });
        setMensagemSucesso('Usuário criado com sucesso!');
      }
      limparFormulario();
      carregarDados();
    } catch (err: any) {
      setMensagemErro(err.message || 'Falha ao salvar o usuário.');
    }
  };

  const excluirUsuario = async (u: any) => {
    if (!window.confirm(`Excluir o usuário "${u.nome}" (${u.igreja?.nome})?`)) return;
    setMensagemErro(null);
    try {
      const res: any = await ApiClient.delete(`/admin/usuarios/${u.id}`);
      setMensagemSucesso(res?.mensagem || 'Usuário excluído.');
      carregarDados();
    } catch (err: any) {
      setMensagemErro(err.message || 'Falha ao excluir o usuário.');
    }
  };

  if (carregando) {
    return <SkeletonPage />;
  }

  const usuariosFiltrados = usuarios.filter((u) => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return true;
    return [u.nome, u.email, u.perfil, u.igreja?.nome]
      .filter(Boolean)
      .some((campo: any) => String(campo).toLowerCase().includes(termo));
  });

  const statsSistema = [
    { label: 'Igrejas', valor: sistema?.totais?.igrejas ?? 0, Icon: Church, cor: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Usuários Ativos', valor: sistema?.totais?.usuariosAtivos ?? 0, Icon: Users, cor: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Células', valor: sistema?.totais?.celulas ?? 0, Icon: UserPlus, cor: 'text-sky-400', bg: 'bg-sky-500/10' },
    { label: 'Relatórios', valor: sistema?.totais?.relatorios ?? 0, Icon: Database, cor: 'text-amber-400', bg: 'bg-amber-500/10' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="card card-pad relative overflow-hidden">
        <div className="absolute -top-24 -right-16 w-56 h-56 rounded-full bg-red-600/10 blur-3xl pointer-events-none" />
        <div className="relative">
          <span className="eyebrow flex items-center gap-1.5">
            <ShieldAlert size={12} />
            Administração do Sistema
          </span>
          <h2 className="page-title mt-1.5">Painel Administrativo</h2>
          <p className="section-sub mt-1">
            Visão global de todas as igrejas, usuários e auditoria
          </p>
        </div>
      </div>

      {mensagemSucesso && (
        <div className="alert-success">
          <span>{mensagemSucesso}</span>
          <button onClick={() => setMensagemSucesso(null)} className="shrink-0 opacity-70 hover:opacity-100"><X size={15} /></button>
        </div>
      )}
      {mensagemErro && (
        <div className="alert-error">
          <span>{mensagemErro}</span>
          <button onClick={() => setMensagemErro(null)} className="shrink-0 opacity-70 hover:opacity-100"><X size={15} /></button>
        </div>
      )}

      {/* Sub-abas */}
      <div className="flex gap-2 flex-wrap">
        {subAbas.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setSubAba(id)}
            className={`tab flex items-center gap-2 ${subAba === id ? 'tab-active' : ''}`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* SUB-ABA: SISTEMA */}
      {subAba === 'sistema' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {statsSistema.map(({ label, valor, Icon, cor, bg }) => (
              <div key={label} className="stat card-hover">
                <div className="flex items-start justify-between">
                  <span className="stat-label">{label}</span>
                  <span className={`w-7 h-7 rounded-lg ${bg} ${cor} flex items-center justify-center`}>
                    <Icon size={14} />
                  </span>
                </div>
                <span className={`stat-value ${cor}`}>{valor}</span>
              </div>
            ))}
          </div>

          {/* Backup & Armazenamento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className={`card card-pad flex items-start gap-3 ${sistema?.segurancaBackup?.alertaBackupPendente ? 'border-red-500/30 bg-red-500/5' : ''}`}>
              <span className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${sistema?.segurancaBackup?.alertaBackupPendente ? 'bg-red-500/15 text-red-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                <ShieldAlert size={15} />
              </span>
              <div className="min-w-0">
                <span className="stat-label block">Backup Automático</span>
                <p className="text-xs text-slate-300 mt-1">
                  {sistema?.segurancaBackup?.alertaBackupPendente
                    ? sistema.segurancaBackup.mensagemAlerta || 'Backup pendente há mais de 48h.'
                    : `Saudável · ${sistema?.segurancaBackup?.totalBackupsRetidos ?? 0} backups retidos`}
                </p>
              </div>
            </div>
            <div className="card card-pad flex items-start gap-3">
              <span className="w-8 h-8 shrink-0 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center">
                <HardDrive size={15} />
              </span>
              <div className="min-w-0">
                <span className="stat-label block">Armazenamento Global</span>
                <p className="text-xs text-slate-300 mt-1">
                  {sistema?.armazenamento?.espacoUsadoFormatado || '0 MB'} utilizados
                </p>
              </div>
            </div>
          </div>

          {/* Lista de igrejas */}
          <section className="card card-pad">
            <h3 className="section-title flex items-center gap-2 mb-4">
              <span className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Church size={15} />
              </span>
              Igrejas Cadastradas ({sistema?.igrejas?.length || 0})
            </h3>
            <div className="space-y-2">
              {(sistema?.igrejas || []).map((ig: any) => (
                <div key={ig.id} className="card-soft card-hover px-3.5 py-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-white block truncate">{ig.nome}</span>
                    <span className="text-[11px] text-slate-500">slug: {ig.slug}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="badge-slate">{ig._count?.usuarios ?? 0} usuários</span>
                    <span className="badge-slate">{ig._count?.celulas ?? 0} células</span>
                    <span className="badge-slate">{ig._count?.relatorios ?? 0} relatórios</span>
                    <span className="badge-slate">{ig._count?.conteudosMidia ?? 0} mídias</span>
                  </div>
                </div>
              ))}
              {(!sistema?.igrejas || sistema.igrejas.length === 0) && (
                <div className="empty-state border-0 bg-transparent p-6">Nenhuma igreja cadastrada.</div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* SUB-ABA: USUÁRIOS */}
      {subAba === 'usuarios' && (
        <div className="space-y-5">
          {/* Formulário */}
          <section className="card card-pad">
            <h3 className="section-title flex items-center gap-2 mb-4">
              <span className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <UserPlus size={15} />
              </span>
              {usuarioEditandoId ? 'Editar Usuário' : 'Novo Usuário (qualquer igreja)'}
            </h3>

            <form onSubmit={salvarUsuario} className="space-y-3">
              {!usuarioEditandoId && (
                <div>
                  <label className="label">Igreja</label>
                  <select
                    required
                    value={formUsuario.igrejaId}
                    onChange={(e) => setFormUsuario((f) => ({ ...f, igrejaId: e.target.value }))}
                    className="input"
                  >
                    <option value="">Selecione a igreja...</option>
                    {(sistema?.igrejas || []).map((ig: any) => (
                      <option key={ig.id} value={ig.id}>{ig.nome}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Nome *</label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    value={formUsuario.nome}
                    onChange={(e) => setFormUsuario((f) => ({ ...f, nome: e.target.value }))}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">E-mail *</label>
                  <input
                    type="email"
                    required
                    value={formUsuario.email}
                    onChange={(e) => setFormUsuario((f) => ({ ...f, email: e.target.value }))}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Senha {usuarioEditandoId ? '(opcional)' : '*'}</label>
                  <input
                    type="password"
                    required={!usuarioEditandoId}
                    minLength={6}
                    value={formUsuario.senha}
                    onChange={(e) => setFormUsuario((f) => ({ ...f, senha: e.target.value }))}
                    placeholder="••••••••"
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Perfil *</label>
                  <select
                    required
                    value={formUsuario.perfil}
                    onChange={(e) => setFormUsuario((f) => ({ ...f, perfil: e.target.value as any }))}
                    className="input"
                  >
                    <option value="CELULA">Líder de Célula</option>
                    <option value="REDE">Líder de Rede</option>
                    <option value="MIDIA">Equipe de Mídia</option>
                    <option value="PASTOR">Pastor</option>
                    <option value="ADM">Administrador</option>
                  </select>
                </div>

                {(formUsuario.perfil === 'CELULA' || formUsuario.perfil === 'REDE') && !usuarioEditandoId && (
                  <>
                    <div>
                      <label className="label">Rede {formUsuario.perfil === 'CELULA' ? '(da célula)' : ''}</label>
                      <input
                        type="text"
                        value={formUsuario.nomeRede}
                        onChange={(e) => setFormUsuario((f) => ({ ...f, nomeRede: e.target.value }))}
                        placeholder="Ex: Rede de Jovens"
                        className="input"
                      />
                    </div>
                    {formUsuario.perfil === 'CELULA' && (
                      <div>
                        <label className="label">Célula</label>
                        <input
                          type="text"
                          value={formUsuario.identificadorCelula}
                          onChange={(e) => setFormUsuario((f) => ({ ...f, identificadorCelula: e.target.value }))}
                          placeholder="Ex: 17"
                          className="input"
                        />
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                {usuarioEditandoId && (
                  <button type="button" onClick={limparFormulario} className="btn-ghost btn-sm">
                    Cancelar edição
                  </button>
                )}
                <button type="submit" className="btn-primary">
                  {usuarioEditandoId ? 'Salvar alterações' : 'Criar usuário'}
                </button>
              </div>
            </form>
          </section>

          {/* Lista de usuários */}
          <section className="card card-pad">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <h3 className="section-title">Usuários de Todas as Igrejas ({usuariosFiltrados.length})</h3>
              <div className="relative w-full sm:w-64">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar nome, e-mail, igreja..."
                  className="input pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              {usuariosFiltrados.map((u) => (
                <div key={u.id} className="card-soft card-hover px-3.5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white truncate">{u.nome}</span>
                      <span className="badge-slate">{perfilLabels[u.perfil] || u.perfil}</span>
                      {!u.ativo && <span className="badge-red">Inativo</span>}
                    </div>
                    <span className="text-xs text-slate-400 block truncate">
                      {u.email} · {u.igreja?.nome || 'Sem igreja'}
                      {u.celula?.nome ? ` · ${u.celula.nome}` : ''}
                      {u.rede?.nome ? ` · ${u.rede.nome}` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => editarUsuario(u)}
                      title="Editar usuário"
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/30 hover:bg-blue-500/20 transition-colors"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => excluirUsuario(u)}
                      title="Excluir usuário"
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/10 text-red-300 border border-red-500/30 hover:bg-red-500/20 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
              {usuariosFiltrados.length === 0 && (
                <div className="empty-state border-0 bg-transparent p-6">Nenhum usuário encontrado.</div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* SUB-ABA: AUDITORIA */}
      {subAba === 'auditoria' && (
        <section className="card card-pad">
          <h3 className="section-title flex items-center gap-2 mb-4">
            <span className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <ScrollText size={15} />
            </span>
            Logs de Auditoria ({auditoria.length})
          </h3>

          <div className="space-y-2">
            {auditoria.map((log) => (
              <div key={log.id} className="card-soft px-3.5 py-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold text-white">{log.acao}</span>
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Clock size={10} />
                    {new Date(log.createdAt).toLocaleString('pt-BR')}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  {log.usuario?.nome || 'Sistema'} ({perfilLabels[log.usuario?.perfil] || log.usuario?.perfil || '—'})
                  {' · '}
                  {log.igreja?.nome || 'Igreja não identificada'}
                  {log.recurso ? ` · ${log.recurso}` : ''}
                </span>
              </div>
            ))}
            {auditoria.length === 0 && (
              <div className="empty-state border-0 bg-transparent p-6">Nenhum registro de auditoria.</div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default AdminView;
