import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard, ClipboardList, Bell, Users, Settings, X, ShieldAlert,
  Network, UserCheck, UserPlus, Activity, FileText, ArrowRight, Check,
  Undo2, Pencil, Trash2, RotateCcw, MapPin, Globe, HardDrive, Trash,
  Calendar, Search
} from 'lucide-react';
import { ApiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';

const subAbas = [
  { id: 'dashboard', label: 'Indicadores', Icon: LayoutDashboard },
  { id: 'relatorios', label: 'Relatórios', Icon: ClipboardList },
  { id: 'aprovacoes', label: 'Aprovações', Icon: Bell },
  { id: 'usuarios', label: 'Usuários', Icon: Users },
  { id: 'configuracoes', label: 'Retenção', Icon: Settings },
] as const;

const statsDashboard = [
  { campo: 'totalCelulas', label: 'Células Ativas', Icon: Network, cor: 'text-blue-400', bg: 'bg-blue-500/10' },
  { campo: 'totalMembrosAtivos', label: 'Membros Ativos', Icon: UserCheck, cor: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { campo: 'novosVisitantes', label: 'Novos Visitantes', Icon: UserPlus, cor: 'text-amber-400', bg: 'bg-amber-500/10' },
  { campo: 'mediaFrequenciaPorReuniao', label: 'Frequência Média', Icon: Activity, cor: 'text-sky-400', bg: 'bg-sky-500/10' },
] as const;

export const PastorView: React.FC = () => {
  const [subAba, setSubAba] = useState<'dashboard' | 'relatorios' | 'aprovacoes' | 'usuarios' | 'configuracoes'>('dashboard');

  // Dashboard & Métricas
  const [dashboard, setDashboard] = useState<any | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [fotoModal, setFotoModal] = useState<string | null>(null);

  // Aprovações da Mídia
  const [pendentes, setPendentes] = useState<any[]>([]);
  const [comentarioDevolucao, setComentarioDevolucao] = useState('');
  const [itemDevolvendoId, setItemDevolvendoId] = useState<string | null>(null);

  // Gestão de Usuários
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [usuarioEditandoId, setUsuarioEditandoId] = useState<string | null>(null);
  const [nomeNovoUser, setNomeNovoUser] = useState('');
  const [emailNovoUser, setEmailNovoUser] = useState('');
  const [senhaNovoUser, setSenhaNovoUser] = useState('');
  const [perfilNovoUser, setPerfilNovoUser] = useState<'CELULA' | 'REDE' | 'MIDIA' | 'PASTOR'>('CELULA');
  const [identificadorCelula, setIdentificadorCelula] = useState('');
  const [nomeRede, setNomeRede] = useState('');
  const [redesDisponiveis, setRedesDisponiveis] = useState<any[]>([]);
  const [buscaUsuario, setBuscaUsuario] = useState('');

  const { usuario: usuarioLogado } = useAuth();

  const usuariosFiltrados = usuarios.filter((u) => {
    const termo = buscaUsuario.trim().toLowerCase();
    if (!termo) return true;
    return [u.nome, u.email, u.perfil, u.celula?.nome, u.rede?.nome, u.celula?.rede?.nome]
      .filter(Boolean)
      .some((campo: any) => String(campo).toLowerCase().includes(termo));
  });

  // Configurações
  const [prazoRetencao, setPrazoRetencao] = useState(60);

  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);

  useEffect(() => {
    carregarDadosPastor();
  }, []);

  const carregarDadosPastor = async () => {
    setCarregando(true);
    try {
      const [resDash, resPendentes, resUsers, resRedes] = await Promise.all([
        ApiClient.get('/dashboard/pastor'),
        ApiClient.get('/midia/pendentes'),
        ApiClient.get('/usuarios'),
        ApiClient.get('/redes').catch(() => ({ redes: [] }))
      ]);
      setDashboard(resDash);
      setPendentes(resPendentes.pendentes || []);
      setUsuarios(resUsers.usuarios || []);
      setRedesDisponiveis(resRedes?.redes || []);
    } catch {
      // Ignora falhas pontuais
    } finally {
      setCarregando(false);
    }
  };

  const handleAprovar = async (id: string) => {
    setMensagemErro(null);
    try {
      await ApiClient.post(`/midia/${id}/aprovar`);
      setMensagemSucesso('Publicação aprovada pelo Pastor e liberada na vitrine!');
      carregarDadosPastor();
    } catch (err: any) {
      setMensagemErro(err.message);
    }
  };

  const handleDevolver = async (id: string) => {
    if (!comentarioDevolucao.trim()) {
      alert('Por favor, informe o comentário explicando o motivo da devolução para a Mídia.');
      return;
    }

    setMensagemErro(null);
    try {
      await ApiClient.post(`/midia/${id}/devolver`, { comentarioPastor: comentarioDevolucao });
      setMensagemSucesso('Conteúdo devolvido à Mídia com o comentário.');
      setItemDevolvendoId(null);
      setComentarioDevolucao('');
      carregarDadosPastor();
    } catch (err: any) {
      setMensagemErro(err.message);
    }
  };

  const limparFormularioUsuario = () => {
    setUsuarioEditandoId(null);
    setNomeNovoUser('');
    setEmailNovoUser('');
    setSenhaNovoUser('');
    setPerfilNovoUser('CELULA');
    setIdentificadorCelula('');
    setNomeRede('');
  };

  const handleCadastrarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensagemErro(null);

    try {
      if (usuarioEditandoId) {
        await ApiClient.patch(`/usuarios/${usuarioEditandoId}`, {
          nome: nomeNovoUser,
          email: emailNovoUser,
          perfil: perfilNovoUser,
          senha: senhaNovoUser || undefined,
          identificadorCelula: perfilNovoUser === 'CELULA' ? identificadorCelula : undefined,
          nomeRede: (perfilNovoUser === 'REDE' || perfilNovoUser === 'CELULA') ? nomeRede : undefined
        });

        limparFormularioUsuario();
        setMensagemSucesso('Usuário atualizado com sucesso!');
      } else {
        await ApiClient.post('/usuarios', {
          nome: nomeNovoUser,
          email: emailNovoUser,
          senha: senhaNovoUser,
          perfil: perfilNovoUser,
          identificadorCelula: perfilNovoUser === 'CELULA' ? identificadorCelula : undefined,
          nomeRede: (perfilNovoUser === 'REDE' || perfilNovoUser === 'CELULA') ? nomeRede : undefined
        });

        limparFormularioUsuario();
        setMensagemSucesso('Novo usuário cadastrado e vinculado com sucesso!');
      }

      carregarDadosPastor();
    } catch (err: any) {
      setMensagemErro(err.message);
    }
  };

  const editarUsuario = (u: any) => {
    setMensagemErro(null);
    setMensagemSucesso(null);
    setUsuarioEditandoId(u.id);
    setNomeNovoUser(u.nome || '');
    setEmailNovoUser(u.email || '');
    setSenhaNovoUser('');
    setPerfilNovoUser(u.perfil);
    setIdentificadorCelula(u.perfil === 'CELULA' ? (u.celula?.nome || '') : '');
    setNomeRede(
      u.perfil === 'REDE' ? (u.rede?.nome || '')
      : u.perfil === 'CELULA' ? (u.celula?.rede?.nome || '')
      : ''
    );
    document.getElementById('formulario-usuario')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const cancelarEdicao = () => {
    limparFormularioUsuario();
    setMensagemErro(null);
  };

  const excluirUsuario = async (u: any) => {
    const confirmacao = window.confirm(
      `Tem certeza que deseja excluir "${u.nome}" (${u.email})?\n\nSe ele possuir relatórios ou conteúdos vinculados, será apenas desativado.`
    );
    if (!confirmacao) return;

    setMensagemErro(null);
    try {
      const res = await ApiClient.delete(`/usuarios/${u.id}`);
      if (usuarioEditandoId === u.id) limparFormularioUsuario();
      setMensagemSucesso(res.message || 'Usuário excluído com sucesso.');
      carregarDadosPastor();
    } catch (err: any) {
      setMensagemErro(err.message);
    }
  };

  const restaurarUsuario = async (u: any) => {
    setMensagemErro(null);
    try {
      await ApiClient.patch(`/usuarios/${u.id}`, { ativo: true });
      setMensagemSucesso(`"${u.nome}" foi reativado com sucesso.`);
      carregarDadosPastor();
    } catch (err: any) {
      setMensagemErro(err.message);
    }
  };

  const contarSubAba = (id: string) => {
    if (id === 'relatorios') return dashboard?.relatorios?.length || 0;
    if (id === 'aprovacoes') return pendentes.length;
    if (id === 'usuarios') return usuarios.length;
    return null;
  };

  if (carregando) {
    return (
      <div className="loading-state">
        <div className="w-7 h-7 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin" />
        Carregando painel pastoral...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header Pastoral */}
      <div className="card card-pad relative overflow-hidden">
        <div className="absolute -top-24 -right-16 w-56 h-56 rounded-full bg-blue-600/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-10 w-44 h-44 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />
        <div className="relative">
          <span className="eyebrow flex items-center gap-1.5">
            <ShieldAlert size={12} />
            Gabinete Pastoral
          </span>
          <h2 className="page-title mt-1.5">Painel Geral da Igreja</h2>
          <p className="section-sub mt-1">
            Supervisão de indicadores, aprovação de mídia, governança e retenção
          </p>

          {/* Sub-abas */}
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-800/80">
            {subAbas.map(({ id, label, Icon }) => {
              const contagem = contarSubAba(id);
              return (
                <button
                  key={id}
                  onClick={() => setSubAba(id as typeof subAba)}
                  className={subAba === id ? 'tab tab-active' : 'tab'}
                >
                  <Icon size={13} className="inline -mt-0.5 mr-1.5" />
                  {label}
                  {contagem !== null && (
                    <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                      subAba === id ? 'bg-white/20' : 'bg-slate-700/70 text-slate-300'
                    }`}>
                      {contagem}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {mensagemSucesso && (
        <div className="alert-success">
          <span>{mensagemSucesso}</span>
          <button onClick={() => setMensagemSucesso(null)} className="shrink-0 opacity-70 hover:opacity-100">
            <X size={15} />
          </button>
        </div>
      )}

      {mensagemErro && (
        <div className="alert-error">
          <span>{mensagemErro}</span>
          <button onClick={() => setMensagemErro(null)} className="shrink-0 opacity-70 hover:opacity-100">
            <X size={15} />
          </button>
        </div>
      )}

      {/* ALERTA CRÍTICO DE BACKUP > 48 HORAS */}
      {dashboard?.segurancaBackup?.alertaBackupPendente && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 flex items-start gap-3">
          <span className="w-8 h-8 shrink-0 rounded-lg bg-red-500/15 text-red-400 flex items-center justify-center">
            <ShieldAlert size={16} />
          </span>
          <div>
            <h4 className="text-sm font-bold text-red-300 mb-0.5">Alerta Crítico de Segurança</h4>
            <p className="text-xs text-slate-300">{dashboard.segurancaBackup.mensagemAlerta}</p>
          </div>
        </div>
      )}

      {/* SUB-ABA: DASHBOARD */}
      {subAba === 'dashboard' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {statsDashboard.map(({ campo, label, Icon, cor, bg }) => (
              <div key={campo} className="stat card-hover">
                <div className="flex items-start justify-between">
                  <span className="stat-label">{label}</span>
                  <span className={`w-7 h-7 rounded-lg ${bg} ${cor} flex items-center justify-center`}>
                    <Icon size={14} />
                  </span>
                </div>
                <span className={`stat-value ${cor}`}>{dashboard?.indicadores?.[campo] || 0}</span>
              </div>
            ))}
          </div>

          {/* Resumo dos Últimos Relatórios */}
          <div className="card card-pad">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                  <FileText size={15} />
                </span>
                Últimos Relatórios Enviados
              </h3>
              <button
                onClick={() => setSubAba('relatorios')}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors"
              >
                Ver todos ({dashboard?.relatorios?.length || 0})
                <ArrowRight size={13} />
              </button>
            </div>

            {(!dashboard?.relatorios || dashboard.relatorios.length === 0) ? (
              <div className="empty-state border-0 bg-transparent p-6">
                Nenhum relatório de célula enviado recentemente.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {dashboard.relatorios.slice(0, 4).map((rel: any) => (
                  <div key={rel.id} className="card-soft card-hover p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-white block truncate">{rel.celula?.nome || 'Célula'}</span>
                        <span className="text-xs text-slate-400">
                          Líder: <strong className="text-slate-200">{rel.lider?.nome || 'Líder'}</strong>
                        </span>
                      </div>
                      <span className={rel.status === 'FECHADO' ? 'badge-emerald' : 'badge-amber'}>
                        {rel.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <UserCheck size={12} className="text-emerald-400" />
                        <strong className="text-white">{rel.presentes}</strong> presentes
                      </span>
                      <span className="flex items-center gap-1.5">
                        <UserPlus size={12} className="text-blue-400" />
                        <strong className="text-white">{rel.visitantes}</strong> visitantes
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Calendar size={12} className="text-slate-500" />
                        {new Date(rel.data).toLocaleDateString('pt-BR')}
                      </span>
                    </div>

                    {rel.observacoes && (
                      <p className="text-xs text-slate-300 italic bg-slate-950/60 p-2 rounded-lg border border-slate-800/70">
                        “{rel.observacoes}”
                      </p>
                    )}

                    {rel.fotoUrl && (
                      <div className="pt-1">
                        <img
                          src={rel.fotoUrl}
                          alt="Foto da Reunião"
                          onClick={() => setFotoModal(rel.fotoUrl)}
                          className="w-full h-28 object-cover rounded-lg border border-slate-800 cursor-pointer hover:opacity-90 transition-opacity"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-ABA: RELATÓRIOS COMPLETOS DAS CÉLULAS */}
      {subAba === 'relatorios' && (
        <div className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h3 className="section-title flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                  <ClipboardList size={15} />
                </span>
                Relatórios Semanais das Células
              </h3>
              <p className="section-sub mt-1">
                Acompanhamento detalhado das reuniões, presença, pedidos de oração e fotos
              </p>
            </div>
            <span className="badge-blue shrink-0">
              Total: {dashboard?.relatorios?.length || 0}
            </span>
          </div>

          {(!dashboard?.relatorios || dashboard.relatorios.length === 0) ? (
            <div className="empty-state">
              <FileText size={22} className="mx-auto mb-2 text-slate-600" />
              Nenhum relatório foi enviado pelos líderes de célula ainda.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dashboard.relatorios.map((rel: any) => (
                <div key={rel.id} className="card card-pad space-y-3 flex flex-col justify-between card-hover">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2">
                      <div className="min-w-0">
                        <span className="text-base font-bold text-white block truncate">{rel.celula?.nome || 'Célula'}</span>
                        <span className="text-xs text-indigo-400 font-medium flex items-center gap-1">
                          <Globe size={11} />
                          {rel.celula?.rede?.nome || 'Rede Geral'}
                        </span>
                      </div>
                      <span className={rel.status === 'FECHADO' ? 'badge-emerald shrink-0' : 'badge-amber shrink-0'}>
                        {rel.status}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>Líder Responsável:</span>
                        <strong className="text-white">{rel.lider?.nome || 'Líder'}</strong>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Data da Reunião:</span>
                        <strong className="text-white">{new Date(rel.data).toLocaleDateString('pt-BR')}</strong>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="card-soft py-2.5 text-center">
                        <span className="text-[10px] uppercase text-slate-400 block">Presentes</span>
                        <span className="text-lg font-bold text-white">{rel.presentes}</span>
                      </div>
                      <div className="card-soft py-2.5 text-center">
                        <span className="text-[10px] uppercase text-slate-400 block">Visitantes</span>
                        <span className="text-lg font-bold text-blue-400">{rel.visitantes}</span>
                      </div>
                    </div>

                    {rel.observacoes && (
                      <div className="card-soft p-3 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider block">
                          Observações & Decisões
                        </span>
                        <p className="text-xs text-slate-200 leading-relaxed italic">
                          “{rel.observacoes}”
                        </p>
                      </div>
                    )}
                  </div>

                  {rel.fotoUrl && (
                    <div className="pt-2 border-t border-slate-800">
                      <span className="text-[10px] uppercase text-slate-400 block mb-1.5 font-medium">
                        Foto da Reunião
                      </span>
                      <img
                        src={rel.fotoUrl}
                        alt="Foto da Célula"
                        onClick={() => setFotoModal(rel.fotoUrl)}
                        className="w-full h-40 object-cover rounded-xl border border-slate-700/80 cursor-pointer hover:opacity-90 transition-opacity"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-ABA: APROVAÇÕES DA MÍDIA */}
      {subAba === 'aprovacoes' && (
        <div className="space-y-4">
          <h3 className="section-title flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Bell size={15} />
            </span>
            Conteúdos Pendentes de Aprovação
            {pendentes.length > 0 && <span className="badge-amber ml-1">{pendentes.length}</span>}
          </h3>

          {pendentes.length === 0 ? (
            <div className="empty-state">
              <Bell size={22} className="mx-auto mb-2 text-slate-600" />
              Nenhum conteúdo aguardando aprovação no momento.
            </div>
          ) : (
            <div className="space-y-3">
              {pendentes.map((item) => (
                <div key={item.id} className="card card-pad space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="badge-slate">{item.tipo}</span>
                    <span className="text-xs text-slate-500">
                      Enviado por: {item.autor?.nome}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-base font-bold text-white">{item.titulo}</h4>
                    {item.descricao && <p className="text-sm text-slate-400 mt-1">{item.descricao}</p>}
                  </div>

                  {itemDevolvendoId === item.id ? (
                    <div className="space-y-2 pt-3 border-t border-slate-800/80">
                      <label className="label">
                        Motivo da Devolução (para a equipe de Mídia corrigir)
                      </label>
                      <textarea
                        rows={2}
                        value={comentarioDevolucao}
                        onChange={(e) => setComentarioDevolucao(e.target.value)}
                        placeholder="Ex: Favor ajustar o horário para 19h e alterar o banner..."
                        className="input resize-none"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => handleDevolver(item.id)} className="btn-danger btn-sm">
                          <Check size={13} />
                          Confirmar Devolução
                        </button>
                        <button
                          onClick={() => { setItemDevolvendoId(null); setComentarioDevolucao(''); }}
                          className="btn-ghost btn-sm"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-800/80">
                      <button onClick={() => handleAprovar(item.id)} className="btn-success btn-sm">
                        <Check size={14} />
                        Aprovar e Publicar na Vitrine
                      </button>
                      <button onClick={() => setItemDevolvendoId(item.id)} className="btn-ghost btn-sm">
                        <Undo2 size={14} />
                        Devolver com Comentário
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-ABA: GESTÃO DE USUÁRIOS */}
      {subAba === 'usuarios' && (
        <div className="space-y-4">
          <div id="formulario-usuario" className="card card-pad">
            <div className="mb-4">
              <h3 className="section-title flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                  <Users size={15} />
                </span>
                {usuarioEditandoId ? 'Editar Usuário' : 'Cadastrar Novo Usuário'}
              </h3>
              <p className="section-sub mt-1">
                {usuarioEditandoId
                  ? 'Altere os dados, o perfil de acesso e os vínculos do usuário'
                  : 'Cadastre líderes de célula, líderes de rede ou a equipe de mídia com seus vínculos'}
              </p>
            </div>
            <form onSubmit={handleCadastrarUsuario} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="label">Nome Completo</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: João da Silva"
                    value={nomeNovoUser}
                    onChange={(e) => setNomeNovoUser(e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">E-mail de Acesso</label>
                  <input
                    type="email"
                    required
                    placeholder="lider@igreja.com"
                    value={emailNovoUser}
                    onChange={(e) => setEmailNovoUser(e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">
                    {usuarioEditandoId ? 'Nova Senha (opcional)' : 'Senha Inicial'}
                  </label>
                  <input
                    type="password"
                    required={!usuarioEditandoId}
                    placeholder={usuarioEditandoId ? 'Deixe em branco para manter a atual' : 'Mínimo 6 dígitos'}
                    value={senhaNovoUser}
                    onChange={(e) => setSenhaNovoUser(e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Perfil de Acesso</label>
                  <select
                    value={perfilNovoUser}
                    onChange={(e) => setPerfilNovoUser(e.target.value as any)}
                    className="input"
                  >
                    <option value="CELULA">Líder de Célula</option>
                    <option value="REDE">Líder de Rede</option>
                    <option value="MIDIA">Equipe de Mídia</option>
                    {usuarioEditandoId && <option value="PASTOR">Pastor</option>}
                  </select>
                </div>
              </div>

              {/* CAMPOS ESPECÍFICOS: LÍDER DE CÉLULA */}
              {perfilNovoUser === 'CELULA' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.04]">
                  <div>
                    <label className="label flex items-center gap-1.5 text-emerald-400">
                      <MapPin size={12} />
                      Número / Identificador da Célula *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 01, 10, Betel, Ágape"
                      value={identificadorCelula}
                      onChange={(e) => setIdentificadorCelula(e.target.value)}
                      className="input"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Número ou nome da célula para identificação no sistema.
                    </span>
                  </div>
                  <div>
                    <label className="label flex items-center gap-1.5 text-emerald-400">
                      <Globe size={12} />
                      Nome da Rede da Célula (opcional)
                    </label>
                    <input
                      type="text"
                      list="redes-sugestoes"
                      placeholder="Ex: Rede de Jovens, Rede da Família"
                      value={nomeRede}
                      onChange={(e) => setNomeRede(e.target.value)}
                      className="input"
                    />
                    <datalist id="redes-sugestoes">
                      {redesDisponiveis.map((r: any) => (
                        <option key={r.id} value={r.nome} />
                      ))}
                    </datalist>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Vincule esta célula a uma rede existente ou digite o nome de uma nova.
                    </span>
                  </div>
                </div>
              )}

              {/* CAMPOS ESPECÍFICOS: LÍDER DE REDE */}
              {perfilNovoUser === 'REDE' && (
                <div className="p-3.5 rounded-xl border border-indigo-500/25 bg-indigo-500/[0.04]">
                  <label className="label flex items-center gap-1.5 text-indigo-400">
                    <Globe size={12} />
                    Nome da Rede *
                  </label>
                  <input
                    type="text"
                    required
                    list="redes-sugestoes-rede"
                    placeholder="Ex: Rede de Jovens, Rede de Mulheres, Rede de Casais"
                    value={nomeRede}
                    onChange={(e) => setNomeRede(e.target.value)}
                    className="input sm:w-1/2"
                  />
                  <datalist id="redes-sugestoes-rede">
                    {redesDisponiveis.map((r: any) => (
                      <option key={r.id} value={r.nome} />
                    ))}
                  </datalist>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    O líder de rede supervisionará todas as células vinculadas a esta rede.
                  </span>
                </div>
              )}

              <div className="flex gap-2">
                <button type="submit" className={usuarioEditandoId ? 'btn-success flex-1' : 'btn-primary flex-1'}>
                  {usuarioEditandoId ? 'Salvar Alterações' : 'Cadastrar Usuário'}
                </button>
                {usuarioEditandoId && (
                  <button type="button" onClick={cancelarEdicao} className="btn-ghost">
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="card card-pad">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="section-title mb-1">
                  Usuários Cadastrados
                  <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 align-middle">
                    {usuarios.length}
                  </span>
                </h3>
                <p className="section-sub">
                  {usuariosFiltrados.length === usuarios.length
                    ? 'Todos os usuários da igreja'
                    : `${usuariosFiltrados.length} de ${usuarios.length} exibidos`}
                </p>
              </div>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  value={buscaUsuario}
                  onChange={(e) => setBuscaUsuario(e.target.value)}
                  placeholder="Buscar por nome, e-mail, célula..."
                  className="input !pl-8 !py-2 w-56 text-sm"
                />
              </div>
            </div>
            <div className="divide-y divide-slate-800/80">
              {usuariosFiltrados.length === 0 && (
                <div className="empty-state border-0 bg-transparent py-6">
                  Nenhum usuário corresponde à busca "{buscaUsuario}".
                </div>
              )}
              {usuariosFiltrados.map((u) => {
                const ehProprioUsuario = usuarioLogado?.id === u.id;
                return (
                <div key={u.id} className={`py-3 flex flex-wrap items-center justify-between gap-2 ${!u.ativo ? 'opacity-60' : ''}`}>
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">{u.nome}</span>
                      {ehProprioUsuario && <span className="badge-amber">Você</span>}
                      {u.celula?.nome && (
                        <span className="badge-emerald">
                          <MapPin size={10} />
                          {u.celula.nome}
                        </span>
                      )}
                      {(u.rede?.nome || u.celula?.rede?.nome) && (
                        <span className="badge-indigo">
                          <Globe size={10} />
                          {u.rede?.nome || u.celula?.rede?.nome}
                        </span>
                      )}
                      {u.ativo === false && <span className="badge-red">Inativo</span>}
                    </div>
                    <span className="text-xs text-slate-400 block">{u.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={
                      u.perfil === 'PASTOR' ? 'badge-amber' :
                      u.perfil === 'REDE' ? 'badge-indigo' :
                      u.perfil === 'CELULA' ? 'badge-emerald' :
                      'badge-purple'
                    }>
                      {u.perfil === 'CELULA' ? 'Líder de Célula' : u.perfil === 'REDE' ? 'Líder de Rede' : u.perfil === 'MIDIA' ? 'Mídia' : 'Pastor'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => editarUsuario(u)}
                        title="Editar usuário"
                        className={usuarioEditandoId === u.id ? 'btn-ghost btn-sm !border-amber-500/40 !text-amber-300' : 'btn-ghost btn-sm'}
                      >
                        <Pencil size={12} />
                        Editar
                      </button>
                      {u.ativo === false ? (
                        <button
                          onClick={() => restaurarUsuario(u)}
                          title="Reativar usuário"
                          className="btn-soft-success btn-sm"
                        >
                          <RotateCcw size={12} />
                          Reativar
                        </button>
                      ) : (
                        <button
                          onClick={() => excluirUsuario(u)}
                          disabled={ehProprioUsuario}
                          title={ehProprioUsuario ? 'Você não pode excluir a própria conta' : 'Excluir usuário'}
                          className="btn-soft-danger btn-sm disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Trash2 size={12} />
                          Excluir
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUB-ABA: RETENÇÃO & ARMAZENAMENTO */}
      {subAba === 'configuracoes' && (
        <div className="card card-pad space-y-6">
          <div>
            <h3 className="section-title flex items-center gap-2 mb-1">
              <span className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Settings size={15} />
              </span>
              Prazo de Retenção de Fotos de Relatórios
            </h3>
            <p className="section-sub mt-1 mb-4">
              Fotos com mais de {prazoRetencao} dias são expurgadas automaticamente (exceto fotos
              marcadas para manter). O relatório em si permanece intacto.
            </p>

            <div className="flex items-center gap-4">
              <input
                type="range"
                min="7"
                max="365"
                value={prazoRetencao}
                onChange={(e) => setPrazoRetencao(Number(e.target.value))}
                className="w-64 accent-blue-500"
              />
              <span className="text-sm font-bold text-white">{prazoRetencao} dias</span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="stat">
              <div className="flex items-start justify-between">
                <span className="stat-label">Espaço em Disco Utilizado</span>
                <span className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                  <HardDrive size={14} />
                </span>
              </div>
              <span className="stat-value">
                {dashboard?.armazenamento?.espacoUsadoFormatado || '0 MB'}
              </span>
            </div>

            <div className="stat">
              <div className="flex items-start justify-between">
                <span className="stat-label">Liberar na Próxima Limpeza</span>
                <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Trash size={14} />
                </span>
              </div>
              <span className="stat-value text-emerald-400">
                {dashboard?.armazenamento?.espacoALiberarFormatado || '0 MB'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Modal Zoom da Foto da Célula */}
      {fotoModal && (
        <div
          onClick={() => setFotoModal(null)}
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-2xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl animate-fade-up">
            <button
              onClick={() => setFotoModal(null)}
              className="absolute top-3 right-3 bg-black/60 hover:bg-black/90 text-white rounded-full w-8 h-8 flex items-center justify-center"
            >
              <X size={16} />
            </button>
            <img src={fotoModal} alt="Foto da Célula Ampliada" className="w-full h-auto max-h-[85vh] object-contain" />
          </div>
        </div>
      )}
    </div>
  );
};

export default PastorView;
