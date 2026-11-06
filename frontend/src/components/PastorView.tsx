import React, { useEffect, useState } from 'react';
import { ApiClient } from '../api/client';

export const PastorView: React.FC = () => {
  const [subAba, setSubAba] = useState<'dashboard' | 'aprovacoes' | 'usuarios' | 'configuracoes'>('dashboard');

  // Dashboard & Métricas
  const [dashboard, setDashboard] = useState<any | null>(null);
  const [carregando, setCarregando] = useState(true);

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
      const [resDash, resPendentes, resUsers] = await Promise.all([
        ApiClient.get('/dashboard/pastor'),
        ApiClient.get('/midia/pendentes'),
        ApiClient.get('/usuarios')
      ]);
      setDashboard(resDash);
      setPendentes(resPendentes.pendentes || []);
      setUsuarios(resUsers.usuarios || []);
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
        perfil: perfilNovoUser
      });

      setNomeNovoUser('');
      setEmailNovoUser('');
      setSenhaNovoUser('');
      setMensagemSucesso('Usuário cadastrado com sucesso!');
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
        <div className="space-y-4">
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
            <h3 className="text-base font-bold text-white mb-3">Cadastrar Novo Usuário</h3>
            <form onSubmit={handleCadastrarUsuario} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input
                type="text"
                required
                placeholder="Nome completo"
                value={nomeNovoUser}
                onChange={(e) => setNomeNovoUser(e.target.value)}
                className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
              />
              <input
                type="email"
                required
                placeholder="E-mail"
                value={emailNovoUser}
                onChange={(e) => setEmailNovoUser(e.target.value)}
                className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
              />
              <input
                type="password"
                required
                placeholder="Senha inicial"
                value={senhaNovoUser}
                onChange={(e) => setSenhaNovoUser(e.target.value)}
                className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
              />
              <select
                value={perfilNovoUser}
                onChange={(e) => setPerfilNovoUser(e.target.value as any)}
                className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
              >
                <option value="CELULA">Líder de Célula</option>
                <option value="REDE">Líder de Rede</option>
                <option value="MIDIA">Equipe de Mídia</option>
              </select>
              <div className="sm:col-span-2 lg:col-span-4">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl text-sm"
                >
                  Cadastrar Usuário
                </button>
              </div>
            </form>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
            <h3 className="text-base font-bold text-white mb-3">Usuários Cadastrados ({usuarios.length})</h3>
            <div className="divide-y divide-slate-800">
              {usuarios.map((u) => (
                <div key={u.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold text-white block">{u.nome}</span>
                    <span className="text-xs text-slate-400">{u.email}</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold uppercase">
                    {u.perfil}
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
    </div>
  );
};

export default PastorView;

