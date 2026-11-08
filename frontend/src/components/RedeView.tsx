import React, { useEffect, useState } from 'react';
import {
  Users, ClipboardCheck, UserCheck, UserPlus, TriangleAlert,
  Calendar, Image as ImageIcon, Radio, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ApiClient, fotoUtilizavel } from '../api/client';

const stats = [
  { chave: 'totalCelulas', label: 'Células', Icon: Users, cor: 'text-blue-400', bg: 'bg-blue-500/10' },
  { chave: 'totalRelatoriosFechados', label: 'Relatórios', Icon: ClipboardCheck, cor: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { chave: 'totalPresentes', label: 'Presentes', Icon: UserCheck, cor: 'text-sky-400', bg: 'bg-sky-500/10' },
  { chave: 'totalVisitantes', label: 'Visitantes', Icon: UserPlus, cor: 'text-amber-400', bg: 'bg-amber-500/10' },
] as const;

export const RedeView: React.FC = () => {
  const { usuario } = useAuth();
  const [dadosRede, setDadosRede] = useState<any | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Fotos dos relatórios: URL assinada -> conteúdo real da imagem
  const [fotos, setFotos] = useState<Record<string, string | null>>({});
  const [fotoModal, setFotoModal] = useState<string | null>(null);

  const redeId = usuario?.redeId;

  useEffect(() => {
    carregarConsolidado();
  }, []);

  useEffect(() => {
    const relatorios: any[] = dadosRede?.relatorios || [];
    relatorios.forEach((rel) => {
      if (rel.fotoUrlAssinada && fotos[rel.id] === undefined) {
        carregarFoto(rel);
      }
    });
  }, [dadosRede]);

  const carregarFoto = async (rel: any) => {
    try {
      const token = new URL(rel.fotoUrlAssinada, window.location.origin).searchParams.get('token');
      const res = token ? await ApiClient.get(`/relatorios/${rel.id}/foto`, { token }) : null;
      const url = res?.fotoUrl;
      setFotos((prev) => ({ ...prev, [rel.id]: fotoUtilizavel(url) ? url : null }));
    } catch {
      setFotos((prev) => ({ ...prev, [rel.id]: null }));
    }
  };

  const carregarConsolidado = async () => {
    setCarregando(true);
    setErro(null);

    try {
      const endpoint = redeId ? `/redes/${redeId}/consolidado` : '/redes/minha';
      const res = await ApiClient.get(endpoint);
      setDadosRede(res);
    } catch (err: any) {
      setErro(err.message || 'Falha ao carregar dados da rede.');
    } finally {
      setCarregando(false);
    }
  };

  if (carregando) {
    return (
      <div className="loading-state">
        <div className="w-7 h-7 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin" />
        Carregando dados da rede...
      </div>
    );
  }

  if (erro) {
    return <div className="alert-error"><span>{erro}</span></div>;
  }

  const valores: Record<string, number> = {
    totalCelulas: dadosRede?.rede?.totalCelulas || 0,
    totalRelatoriosFechados: dadosRede?.consolidado?.totalRelatoriosFechados || 0,
    totalPresentes: dadosRede?.consolidado?.totalPresentes || 0,
    totalVisitantes: dadosRede?.consolidado?.totalVisitantes || 0,
  };

  const pendentes: any[] = dadosRede?.celulasPendentes || [];
  const relatorios: any[] = dadosRede?.relatorios || [];

  return (
    <div className="space-y-5">
      {/* Header da Rede */}
      <div className="card card-pad relative overflow-hidden">
        <div className="absolute -top-24 -right-16 w-56 h-56 rounded-full bg-blue-600/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-10 w-44 h-44 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />
        <div className="relative">
          <span className="eyebrow flex items-center gap-1.5">
            <Radio size={12} />
            Área do Líder de Rede
          </span>
          <h2 className="page-title mt-1.5">
            {dadosRede?.rede?.nome || 'Minha Rede'}
          </h2>
          <p className="section-sub mt-1">
            Acompanhamento consolidado das células e relatórios fechados
          </p>
        </div>
      </div>

      {/* Cards de Consolidado Semanal */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(({ chave, label, Icon, cor, bg }) => (
          <div key={chave} className="stat card-hover">
            <div className="flex items-start justify-between">
              <span className="stat-label">{label}</span>
              <span className={`w-7 h-7 rounded-lg ${bg} ${cor} flex items-center justify-center`}>
                <Icon size={14} />
              </span>
            </div>
            <span className={`stat-value ${cor}`}>{valores[chave]}</span>
          </div>
        ))}
      </div>

      {/* ALERTA DE CÉLULAS SEM RELATÓRIO */}
      {pendentes.length > 0 && (
        <section className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/10 to-transparent p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <TriangleAlert size={15} />
            </span>
            <h3 className="text-sm font-bold text-amber-300">
              Células Pendentes de Relatório ({pendentes.length})
            </h3>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            Estas células ainda não enviaram ou não fecharam o relatório desta semana:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {pendentes.map((c) => (
              <div key={c.id} className="card-soft px-3.5 py-3 flex justify-between items-center gap-3">
                <span className="text-sm font-semibold text-white truncate">{c.nome}</span>
                <span className="text-xs text-slate-400 whitespace-nowrap flex items-center gap-1.5">
                  <Calendar size={12} className="text-amber-400" />
                  {c.diaSemana} · {c.horario}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Relatórios Fechados com Fotos */}
      <section className="card card-pad">
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-title">Relatórios Fechados da Rede</h3>
          <span className="badge-blue">{relatorios.length} nesta semana</span>
        </div>

        {relatorios.length === 0 ? (
          <div className="empty-state border-0 bg-transparent p-6">
            Nenhum relatório fechado nesta semana.
          </div>
        ) : (
          <div className="space-y-3">
            {relatorios.map((rel) => (
              <div key={rel.id} className="card-soft card-hover p-4 flex flex-col sm:flex-row gap-4 justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-sm font-bold text-white">{rel.celula?.nome}</span>
                    <span className="badge-slate">Líder: {rel.lider?.nome}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mb-2.5">
                    <span className="flex items-center gap-1.5">
                      <Calendar size={12} className="text-slate-500" />
                      {new Date(rel.data).toLocaleDateString('pt-BR')}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <UserCheck size={12} className="text-emerald-400" />
                      <b className="text-white">{rel.presentes}</b> presentes
                    </span>
                    <span className="flex items-center gap-1.5">
                      <UserPlus size={12} className="text-amber-400" />
                      <b className="text-white">{rel.visitantes}</b> visitantes
                    </span>
                  </div>

                  {rel.observacoes && (
                    <p className="text-xs text-slate-400 italic bg-slate-950/60 px-3 py-2 rounded-lg border border-slate-800/70">
                      “{rel.observacoes}”
                    </p>
                  )}
                </div>

                {rel.fotoUrlAssinada && fotos[rel.id] !== null && (
                  <div className="sm:w-40 flex-shrink-0">
                    {fotos[rel.id] ? (
                      <button
                        type="button"
                        onClick={() => setFotoModal(fotos[rel.id]!)}
                        title="Ampliar foto da reunião"
                        className="relative w-full h-24 sm:h-full min-h-[96px] rounded-xl overflow-hidden border border-slate-700/70 bg-slate-950 group block text-left"
                      >
                        <img
                          src={fotos[rel.id]!}
                          alt={`Foto da reunião — ${rel.celula?.nome}`}
                          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-transparent" />
                        <span className="absolute bottom-1.5 left-0 right-0 text-[10px] font-semibold text-white flex items-center justify-center gap-1.5">
                          <ImageIcon size={11} />
                          Ver foto
                        </span>
                      </button>
                    ) : (
                      <div className="w-full h-24 sm:h-full min-h-[96px] rounded-xl border border-dashed border-slate-700/70 bg-slate-950/60 flex items-center justify-center animate-pulse">
                        <ImageIcon size={16} className="text-slate-600" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modal de Ampliação da Foto */}
      {fotoModal && (
        <div
          onClick={() => setFotoModal(null)}
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-2xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl animate-fade-up">
            <button
              onClick={() => setFotoModal(null)}
              title="Fechar"
              className="absolute top-3 right-3 bg-black/60 hover:bg-black/90 text-white rounded-full w-8 h-8 flex items-center justify-center z-10"
            >
              <X size={16} />
            </button>
            <img
              src={fotoModal}
              alt="Foto da reunião ampliada"
              className="w-full h-auto max-h-[85vh] object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default RedeView;
