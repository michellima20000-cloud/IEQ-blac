import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiClient } from '../api/client';

export const RedeView: React.FC = () => {
  const { usuario } = useAuth();
  const [dadosRede, setDadosRede] = useState<any | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const redeId = usuario?.redeId;

  useEffect(() => {
    if (redeId) {
      carregarConsolidado();
    }
  }, [redeId]);

  const carregarConsolidado = async () => {
    if (!redeId) return;
    setCarregando(true);
    setErro(null);

    try {
      const res = await ApiClient.get(`/redes/${redeId}/consolidado`);
      setDadosRede(res);
    } catch (err: any) {
      setErro(err.message || 'Falha ao carregar dados da rede.');
    } finally {
      setCarregando(false);
    }
  };

  if (carregando) {
    return <div className="text-center py-12 text-slate-400">Carregando dados da rede...</div>;
  }

  if (erro) {
    return <div className="p-4 bg-red-500/15 border border-red-500/30 rounded-xl text-red-400 text-sm">{erro}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header do Líder de Rede */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6">
        <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider block mb-1">
          Área do Líder de Rede
        </span>
        <h2 className="text-xl sm:text-2xl font-bold text-white">{dadosRede?.rede?.nome || 'Minha Rede'}</h2>
        <p className="text-slate-400 text-sm">Acompanhamento consolidado das células e relatórios fechados</p>
      </div>

      {/* Cards de Consolidado Semanal */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 block mb-1">Total de Células</span>
          <span className="text-2xl font-bold text-white">{dadosRede?.rede?.totalCelulas || 0}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 block mb-1">Relatórios Enviados</span>
          <span className="text-2xl font-bold text-emerald-400">{dadosRede?.consolidado?.totalRelatoriosFechados || 0}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 block mb-1">Total Presentes</span>
          <span className="text-2xl font-bold text-blue-400">{dadosRede?.consolidado?.totalPresentes || 0}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 block mb-1">Total Visitantes</span>
          <span className="text-2xl font-bold text-amber-400">{dadosRede?.consolidado?.totalVisitantes || 0}</span>
        </div>
      </div>

      {/* ALERTA DE CÉLULAS SEM RELATÓRIO */}
      {dadosRede?.celulasPendentes && dadosRede.celulasPendentes.length > 0 && (
        <section className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">⚠️</span>
            <h3 className="text-sm sm:text-base font-bold text-red-400">
              Células Pendentes de Relatório na Semana ({dadosRede.celulasPendentes.length})
            </h3>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            As seguintes células ainda não enviaram ou não fecharam o relatório desta semana:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {dadosRede.celulasPendentes.map((c: any) => (
              <div key={c.id} className="bg-slate-950/80 border border-red-500/20 rounded-xl p-3 flex justify-between items-center">
                <span className="text-sm font-semibold text-white">{c.nome}</span>
                <span className="text-xs text-slate-400 font-mono">{c.diaSemana} - {c.horario}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Relatórios Fechados com Fotos */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
        <h3 className="text-base font-bold text-white mb-4">Relatórios Fechados da Rede</h3>

        {(!dadosRede?.relatorios || dadosRede.relatorios.length === 0) ? (
          <p className="text-slate-400 text-sm text-center py-6">Nenhum relatório fechado nesta semana.</p>
        ) : (
          <div className="space-y-3">
            {dadosRede.relatorios.map((rel: any) => (
              <div key={rel.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row gap-4 justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-white">{rel.celula?.nome}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                      Líder: {rel.lider?.nome}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 space-x-3 mb-2">
                    <span>📅 {new Date(rel.data).toLocaleDateString('pt-BR')}</span>
                    <span>👥 Presentes: <b className="text-white">{rel.presentes}</b></span>
                    <span>⭐ Visitantes: <b className="text-white">{rel.visitantes}</b></span>
                  </div>
                  {rel.observacoes && (
                    <p className="text-xs text-slate-400 italic bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                      "{rel.observacoes}"
                    </p>
                  )}
                </div>

                {rel.fotoUrlAssinada && (
                  <div className="sm:w-32 flex-shrink-0">
                    <a
                      href={rel.fotoUrlAssinada}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-center text-xs text-blue-400 hover:text-blue-300 font-semibold border border-blue-500/30 rounded-lg p-2 bg-blue-500/10"
                    >
                      📷 Ver Foto Assinada
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default RedeView;

