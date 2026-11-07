import React, { useEffect, useState } from 'react';
import { ApiClient } from '../api/client';

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
  const [nomeNovoUser, setNomeNovoUser] = useState('');
  const [emailNovoUser, setEmailNovoUser] = useState('');
  const [senhaNovoUser, setSenhaNovoUser] = useState('');
  const [perfilNovoUser, setPerfilNovoUser] = useState<'CELULA' | 'REDE' | 'MIDIA'>('CELULA');
  const [identificadorCelula, setIdentificadorCelula] = useState('');
  const [nomeRede, setNomeRede] = useState('');
  const [redesDisponiveis, setRedesDisponiveis] = useState<any[]>([]);

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

  const handleCadastrarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensagemErro(null);

    try {
      await ApiClient.post('/usuarios', {
        nome: nomeNovoUser,
        email: emailNovoUser,
        senha: senhaNovoUser,
        perfil: perfilNovoUser,
        identificadorCelula: perfilNovoUser === 'CELULA' ? identificadorCelula : undefined,
        nomeRede: (perfilNovoUser === 'REDE' || perfilNovoUser === 'CELULA') ? nomeRede : undefined
      });

      setNomeNovoUser('');
      setEmailNovoUser('');
      setSenhaNovoUser('');
      setIdentificadorCelula('');
      setNomeRede('');
      setMensagemSucesso('Novo usuário cadastrado e vinculado com sucesso!');
      carregarDadosPastor();
    } catch (err: any) {
      setMensagemErro(err.message);
    }
  };

  if (carregando) {
    return <div className="text-center py-12 text-slate-400">Carregando painel pastoral...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header Pastoral */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6">
        <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider block mb-1">
          Gabinete Pastoral
        </span>
        <h2 className="text-xl sm:text-2xl font-bold text-white">Painel Geral da Igreja</h2>
        <p className="text-slate-400 text-sm">Supervisão de indicadores, aprovação de mídia, governança e retenção</p>

        {/* Sub-abas */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-800">
          <button
            onClick={() => setSubAba('dashboard')}
            className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
              subAba === 'dashboard' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300'
            }`}
          >
            📊 Indicadores
          </button>
          <button
            onClick={() => setSubAba('relatorios')}
            className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
              subAba === 'relatorios' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300'
            }`}
          >
            📋 Relatórios das Células ({dashboard?.relatorios?.length || 0})
          </button>
          <button
            onClick={() => setSubAba('aprovacoes')}
            className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
              subAba === 'aprovacoes' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300'
            }`}
          >
            🔔 Aprovações ({pendentes.length})
          </button>
          <button
            onClick={() => setSubAba('usuarios')}
            className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
              subAba === 'usuarios' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300'
            }`}
          >
            👥 Usuários ({usuarios.length})
          </button>
          <button
            onClick={() => setSubAba('configuracoes')}
            className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
              subAba === 'configuracoes' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300'
            }`}
          >
            ⚙️ Retenção & Armazenamento
          </button>
        </div>
      </div>

      {mensagemSucesso && (
        <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm flex items-center justify-between">
          <span>{mensagemSucesso}</span>
          <button onClick={() => setMensagemSucesso(null)} className="text-xs font-bold text-emerald-400 ml-2">✕</button>
        </div>
      )}

      {mensagemErro && (
        <div className="p-3.5 bg-red-500/15 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center justify-between">
          <span>{mensagemErro}</span>
          <button onClick={() => setMensagemErro(null)} className="text-xs font-bold text-red-400 ml-2">✕</button>
        </div>
      )}

      {/* ALERTA CRÍTICO DE BACKUP > 48 HORAS */}
      {dashboard?.segurancaBackup?.alertaBackupPendente && (
        <div className="p-4 bg-red-500/15 border border-red-500/40 rounded-2xl flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <h4 className="text-sm font-bold text-red-400 mb-0.5">Alerta Crítico de Segurança</h4>
            <p className="text-xs text-slate-300">{dashboard.segurancaBackup.mensagemAlerta}</p>
          </div>
        </div>
      )}

      {/* SUB-ABA: DASHBOARD */}
      {subAba === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <span className="text-xs text-slate-400 block mb-1">Células Ativas</span>
              <span className="text-2xl font-bold text-white">{dashboard?.indicadores?.totalCelulas || 0}</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <span className="text-xs text-slate-400 block mb-1">Membros Ativos</span>
              <span className="text-2xl font-bold text-emerald-400">{dashboard?.indicadores?.totalMembrosAtivos || 0}</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <span className="text-xs text-slate-400 block mb-1">Novos Visitantes</span>
              <span className="text-2xl font-bold text-amber-400">{dashboard?.indicadores?.novosVisitantes || 0}</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <span className="text-xs text-slate-400 block mb-1">Frequência Média</span>
              <span className="text-2xl font-bold text-blue-400">{dashboard?.indicadores?.mediaFrequenciaPorReuniao || 0}</span>
            </div>
          </div>

          {/* Resumo dos Últimos Relatórios */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">Últimos Relatórios Semanais Enviados</h3>
              <button
                onClick={() => setSubAba('relatorios')}
                className="text-xs text-amber-400 hover:underline font-semibold"
              >
                Ver todos ({dashboard?.relatorios?.length || 0}) →
              </button>
            </div>

            {(!dashboard?.relatorios || dashboard.relatorios.length === 0) ? (
              <p className="text-xs text-slate-500 py-4 text-center">Nenhum relatório de célula enviado recentemente.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {dashboard.relatorios.slice(0, 4).map((rel: any) => (
                  <div key={rel.id} className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-sm font-bold text-white block">{rel.celula?.nome || 'Célula'}</span>
                        <span className="text-xs text-slate-400">
                          Líder: <strong className="text-slate-200">{rel.lider?.nome || 'Líder'}</strong>
                        </span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        rel.status === 'FECHADO' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {rel.status}
                      </span>
                    </div>

                    <div className="flex gap-4 text-xs">
                      <span className="text-slate-300">👥 <strong>{rel.presentes}</strong> presentes</span>
                      <span className="text-blue-400">⭐ <strong>{rel.visitantes}</strong> visitantes</span>
                      <span className="text-slate-500">📅 {new Date(rel.data).toLocaleDateString('pt-BR')}</span>
                    </div>

                    {rel.observacoes && (
                      <p className="text-xs text-slate-300 italic bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                        "{rel.observacoes}"
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
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Relatórios Semanais das Células</h3>
              <p className="text-xs text-slate-400">Acompanhamento detalhado das reuniões, presença, pedidos de oração e fotos</p>
            </div>
            <span className="text-xs px-3 py-1 bg-slate-800 text-slate-300 rounded-lg">
              Total: <strong>{dashboard?.relatorios?.length || 0}</strong>
            </span>
          </div>

          {(!dashboard?.relatorios || dashboard.relatorios.length === 0) ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
              Nenhum relatório foi enviado pelos líderes de célula ainda.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dashboard.relatorios.map((rel: any) => (
                <div key={rel.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2">
                      <div>
                        <span className="text-base font-bold text-white block">{rel.celula?.nome || 'Célula'}</span>
                        <span className="text-xs text-indigo-400 font-medium">
                          {rel.celula?.rede?.nome || 'Rede Geral'}
                        </span>
                      </div>
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        rel.status === 'FECHADO' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}>
                        {rel.status}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-slate-300">
                        <span>Líder Responsável:</span>
                        <strong className="text-white">{rel.lider?.nome || 'Líder'}</strong>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>Data da Reunião:</span>
                        <strong className="text-white">{new Date(rel.data).toLocaleDateString('pt-BR')}</strong>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center">
                        <span className="text-[10px] uppercase text-slate-400 block">Presentes</span>
                        <span className="text-lg font-bold text-white">{rel.presentes}</span>
                      </div>
                      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center">
                        <span className="text-[10px] uppercase text-slate-400 block">Visitantes</span>
                        <span className="text-lg font-bold text-blue-400">{rel.visitantes}</span>
                      </div>
                    </div>

                    {rel.observacoes && (
                      <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider block">Observações & Decisões:</span>
                        <p className="text-xs text-slate-200 leading-relaxed italic">
                          "{rel.observacoes}"
                        </p>
                      </div>
                    )}
                  </div>

                  {rel.fotoUrl && (
                    <div className="pt-2 border-t border-slate-800">
                      <span className="text-[10px] uppercase text-slate-400 block mb-1.5 font-medium">Foto da Reunião:</span>
                      <img
                        src={rel.fotoUrl}
                        alt="Foto da Célula"
                        onClick={() => setFotoModal(rel.fotoUrl)}
                        className="w-full h-40 object-cover rounded-xl border border-slate-700/80 cursor-pointer hover:opacity-90 transition-opacity shadow-md"
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
          <h3 className="text-base font-bold text-white">Conteúdos Pendentes de Aprovação</h3>
          {pendentes.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
              Nenhum conteúdo aguardando aprovação no momento.
            </div>
          ) : (
            <div className="space-y-3">
              {pendentes.map((item) => (
                <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold uppercase">
                      {item.tipo}
                    </span>
                    <span className="text-xs text-slate-500">
                      Enviado por: {item.autor?.nome}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-base font-bold text-white">{item.titulo}</h4>
                    {item.descricao && <p className="text-sm text-slate-400 mt-1">{item.descricao}</p>}
                  </div>

                  {itemDevolvendoId === item.id ? (
                    <div className="space-y-2 pt-2 border-t border-slate-800">
                      <label className="block text-xs font-medium text-slate-300">
                        Motivo da Devolução (para a equipe de Mídia corrigir):
                      </label>
                      <textarea
                        rows={2}
                        value={comentarioDevolucao}
                        onChange={(e) => setComentarioDevolucao(e.target.value)}
                        placeholder="Ex: Favor ajustar o horário para 19h e alterar o banner..."
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDevolver(item.id)}
                          className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-semibold"
                        >
                          Confirmar Devolução
                        </button>
                        <button
                          onClick={() => { setItemDevolvendoId(null); setComentarioDevolucao(''); }}
                          className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 pt-2 border-t border-slate-800">
                      <button
                        onClick={() => handleAprovar(item.id)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs"
                      >
                        ✓ Aprovar e Publicar na Vitrine
                      </button>
                      <button
                        onClick={() => setItemDevolvendoId(item.id)}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs border border-slate-700"
                      >
                        ↩ Devolver com Comentário
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
            <div className="mb-4">
              <h3 className="text-base font-bold text-white">Cadastrar Novo Usuário</h3>
              <p className="text-xs text-slate-400">Cadastre líderes de célula, líderes de rede ou a equipe de mídia com seus vínculos</p>
            </div>
            <form onSubmit={handleCadastrarUsuario} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Nome Completo</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: João da Silva"
                    value={nomeNovoUser}
                    onChange={(e) => setNomeNovoUser(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">E-mail de Acesso</label>
                  <input
                    type="email"
                    required
                    placeholder="lider@igreja.com"
                    value={emailNovoUser}
                    onChange={(e) => setEmailNovoUser(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Senha Inicial</label>
                  <input
                    type="password"
                    required
                    placeholder="Mínimo 6 dígitos"
                    value={senhaNovoUser}
                    onChange={(e) => setSenhaNovoUser(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Perfil de Acesso</label>
                  <select
                    value={perfilNovoUser}
                    onChange={(e) => setPerfilNovoUser(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:border-amber-500 focus:outline-none"
                  >
                    <option value="CELULA">Líder de Célula</option>
                    <option value="REDE">Líder de Rede</option>
                    <option value="MIDIA">Equipe de Mídia</option>
                  </select>
                </div>
              </div>

              {/* CAMPOS ESPECÍFICOS: LÍDER DE CÉLULA */}
              {perfilNovoUser === 'CELULA' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-950/70 rounded-xl border border-emerald-500/30">
                  <div>
                    <label className="block text-xs font-semibold text-emerald-400 mb-1">
                      📍 Número / Identificador da Célula *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 01, 10, Betel, Ágape"
                      value={identificadorCelula}
                      onChange={(e) => setIdentificadorCelula(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Número ou nome da célula para identificação no sistema.
                    </span>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-emerald-400 mb-1">
                      🌐 Nome da Rede da Célula (opcional)
                    </label>
                    <input
                      type="text"
                      list="redes-sugestoes"
                      placeholder="Ex: Rede de Jovens, Rede da Família"
                      value={nomeRede}
                      onChange={(e) => setNomeRede(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
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
                <div className="p-3.5 bg-slate-950/70 rounded-xl border border-indigo-500/30">
                  <label className="block text-xs font-semibold text-indigo-400 mb-1">
                    🌐 Nome da Rede *
                  </label>
                  <input
                    type="text"
                    required
                    list="redes-sugestoes-rede"
                    placeholder="Ex: Rede de Jovens, Rede de Mulheres, Rede de Casais"
                    value={nomeRede}
                    onChange={(e) => setNomeRede(e.target.value)}
                    className="w-full sm:w-1/2 px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
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

              <button
                type="submit"
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl text-sm transition-colors shadow-lg shadow-amber-600/20"
              >
                Cadastrar Usuário
              </button>
            </form>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
            <h3 className="text-base font-bold text-white mb-3">Usuários Cadastrados ({usuarios.length})</h3>
            <div className="divide-y divide-slate-800">
              {usuarios.map((u) => (
                <div key={u.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">{u.nome}</span>
                      {u.celula?.nome && (
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/30">
                          📍 {u.celula.nome}
                        </span>
                      )}
                      {(u.rede?.nome || u.celula?.rede?.nome) && (
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-medium border border-indigo-500/30">
                          🌐 {u.rede?.nome || u.celula?.rede?.nome}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 block">{u.email}</span>
                  </div>
                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                    u.perfil === 'PASTOR' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                    u.perfil === 'REDE' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' :
                    u.perfil === 'CELULA' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                    'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  }`}>
                    {u.perfil === 'CELULA' ? 'Líder de Célula' : u.perfil === 'REDE' ? 'Líder de Rede' : u.perfil === 'MIDIA' ? 'Mídia' : 'Pastor'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUB-ABA: RETENÇÃO & ARMAZENAMENTO */}
      {subAba === 'configuracoes' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-white mb-1">Prazo de Retenção de Fotos de Relatórios</h3>
            <p className="text-xs text-slate-400 mb-4">
              Fotos com mais de {prazoRetencao} dias são expurgadas automaticamente (exceto fotos marcadas para manter). O relatório em si permanece intacto.
            </p>

            <div className="flex items-center gap-4">
              <input
                type="range"
                min="7"
                max="365"
                value={prazoRetencao}
                onChange={(e) => setPrazoRetencao(Number(e.target.value))}
                className="w-64"
              />
              <span className="text-sm font-bold text-white">{prazoRetencao} dias</span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 block mb-1">Espaço em Disco Utilizado</span>
              <span className="text-xl font-bold text-white">
                {dashboard?.armazenamento?.espacoUsadoFormatado || '0 MB'}
              </span>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 block mb-1">Espaço Estimado a Liberar na Próxima Limpeza</span>
              <span className="text-xl font-bold text-emerald-400">
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
          <div className="relative max-w-2xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl">
            <button
              onClick={() => setFotoModal(null)}
              className="absolute top-3 right-3 bg-black/60 hover:bg-black/90 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm"
            >
              ✕
            </button>
            <img src={fotoModal} alt="Foto da Célula Ampliada" className="w-full h-auto max-h-[85vh] object-contain" />
          </div>
        </div>
      )}
    </div>
  );
};

export default PastorView;

