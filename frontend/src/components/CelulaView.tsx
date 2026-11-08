import React, { useEffect, useState, useRef } from 'react';
import {
  Home, ClipboardList, Users, UserPlus, FileText, Camera,
  Check, Save, Loader2, Lock, X, Phone, CircleCheck, TriangleAlert, Inbox
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ApiClient } from '../api/client';

export const CelulaView: React.FC = () => {
  const { usuario } = useAuth();
  const [subAba, setSubAba] = useState<'membros' | 'relatorio'>('relatorio');

  // Membros & Visitantes
  const [membros, setMembros] = useState<any[]>([]);
  const [visitantes, setVisitantes] = useState<any[]>([]);
  const [nomeNovoMembro, setNomeNovoMembro] = useState('');
  const [telefoneNovoMembro, setTelefoneNovoMembro] = useState('');
  const [nomeNovoVisitante, setNomeNovoVisitante] = useState('');
  const [telefoneNovoVisitante, setTelefoneNovoVisitante] = useState('');

  // Formulário de Relatório
  const [dataRelatorio, setDataRelatorio] = useState(new Date().toISOString().split('T')[0]);
  const [presentes, setPresentes] = useState(10);
  const [totalVisitantes, setTotalVisitantes] = useState(2);
  const [observacoes, setObservacoes] = useState('');
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);
  const [relatorioAtual, setRelatorioAtual] = useState<any | null>(null);
  const [celulaAtual, setCelulaAtual] = useState<any | null>(null);
  const [celulaId, setCelulaId] = useState<string | null>(usuario?.celulaId || null);

  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    carregarMinhaCelula();
  }, []);

  const carregarMinhaCelula = async () => {
    try {
      const res = await ApiClient.get('/celulas/minha');
      if (res.celula) {
        setCelulaAtual(res.celula);
        setCelulaId(res.celula.id);
        carregarMembrosEVisitantes(res.celula.id);
      }
    } catch {
      if (usuario?.celulaId) {
        setCelulaId(usuario.celulaId);
        carregarMembrosEVisitantes(usuario.celulaId);
      }
    }
  };

  const carregarMembrosEVisitantes = async (id?: string) => {
    const cid = id || celulaId;
    if (!cid) return;
    try {
      const [resM, resV] = await Promise.all([
        ApiClient.get(`/celulas/${cid}/membros`),
        ApiClient.get(`/celulas/${cid}/visitantes`)
      ]);
      setMembros(resM.membros || []);
      setVisitantes(resV.visitantes || []);
    } catch {
      // Ignora falha inicial
    }
  };

  const handleCadastrarMembro = async (e: React.FormEvent) => {
    e.preventDefault();
    const cid = celulaId || celulaAtual?.id;
    if (!cid) {
      setMensagemErro('Carregando célula... tente novamente em instantes.');
      return;
    }
    setMensagemErro(null);

    try {
      await ApiClient.post(`/celulas/${cid}/membros`, {
        nome: nomeNovoMembro,
        telefone: telefoneNovoMembro
      });
      setNomeNovoMembro('');
      setTelefoneNovoMembro('');
      setMensagemSucesso('Membro cadastrado com sucesso!');
      carregarMembrosEVisitantes(cid);
    } catch (err: any) {
      setMensagemErro(err.message);
    }
  };

  const handleCadastrarVisitante = async (e: React.FormEvent) => {
    e.preventDefault();
    const cid = celulaId || celulaAtual?.id;
    if (!cid) {
      setMensagemErro('Carregando célula... tente novamente em instantes.');
      return;
    }
    setMensagemErro(null);

    try {
      await ApiClient.post(`/celulas/${cid}/visitantes`, {
        nome: nomeNovoVisitante,
        telefone: telefoneNovoVisitante
      });
      setNomeNovoVisitante('');
      setTelefoneNovoVisitante('');
      setMensagemSucesso('Visitante cadastrado com sucesso!');
      carregarMembrosEVisitantes(cid);
    } catch (err: any) {
      setMensagemErro(err.message);
    }
  };

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setFotoBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCriarRelatorio = async (e: React.FormEvent) => {
    e.preventDefault();
    const cid = celulaId || celulaAtual?.id;
    if (!cid) {
      setMensagemErro('Identificando sua célula... aguarde um instante e clique novamente.');
      await carregarMinhaCelula();
      return;
    }
    setMensagemErro(null);
    setEnviando(true);

    try {
      const res = await ApiClient.post(`/celulas/${cid}/relatorios`, {
        data: dataRelatorio,
        presentes: Number(presentes),
        visitantes: Number(totalVisitantes),
        observacoes,
        fotoUrl: fotoBase64 || 'minio://ieq-local/relatorios/reuniao_celula.webp'
      });

      setRelatorioAtual(res.relatorio);
      setMensagemSucesso('Relatório semanal criado com sucesso em status ABERTO!');
    } catch (err: any) {
      setMensagemErro(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const handleFecharRelatorio = async () => {
    if (!relatorioAtual) return;
    const confirmou = window.confirm(
      'Atenção: Ao fechar o relatório, ele se tornará IMUTÁVEL e não poderá mais ser editado. Confirmar fechamento?'
    );
    if (!confirmou) return;

    setMensagemErro(null);
    try {
      const res = await ApiClient.post(`/relatorios/${relatorioAtual.id}/fechar`);
      setRelatorioAtual(res.relatorio);
      setMensagemSucesso('Relatório FECHADO com sucesso! Ele agora está disponível para o Líder de Rede e Pastor.');
    } catch (err: any) {
      setMensagemErro(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header do Líder */}
      <div className="card card-pad relative overflow-hidden">
        <div className="absolute -top-24 -right-16 w-56 h-56 rounded-full bg-blue-600/15 blur-3xl pointer-events-none" />
        <div className="relative">
          <span className="eyebrow flex items-center gap-1.5">
            <Home size={12} />
            Área do Líder de Célula
          </span>
          <h2 className="page-title mt-1.5">
            {celulaAtual ? `Minha Célula: ${celulaAtual.nome}` : 'Minha Célula'}
          </h2>
          <p className="section-sub mt-1">
            Gerencie os membros da sua célula e envie o relatório semanal com foto
          </p>

          {/* Abas Sub-navegação */}
          <div className="flex gap-2 mt-4 pt-4 border-t border-slate-800">
            <button
              onClick={() => setSubAba('relatorio')}
              className={`inline-flex items-center gap-1.5 tab ${subAba === 'relatorio' ? 'tab-active' : ''}`}
            >
              <ClipboardList size={14} />
              Relatório Semanal
            </button>
            <button
              onClick={() => setSubAba('membros')}
              className={`inline-flex items-center gap-1.5 tab ${subAba === 'membros' ? 'tab-active' : ''}`}
            >
              <Users size={14} />
              Membros & Visitantes ({membros.length})
            </button>
          </div>
        </div>
      </div>

      {mensagemSucesso && (
        <div className="alert-success">
          <span className="flex items-center gap-2">
            <CircleCheck size={16} className="shrink-0" />
            {mensagemSucesso}
          </span>
          <button
            onClick={() => setMensagemSucesso(null)}
            className="text-emerald-400 hover:text-white transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {mensagemErro && (
        <div className="alert-error">
          <span className="flex items-center gap-2">
            <TriangleAlert size={16} className="shrink-0" />
            {mensagemErro}
          </span>
          <button
            onClick={() => setMensagemErro(null)}
            className="text-red-400 hover:text-white transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ABA: RELATÓRIO SEMANAL */}
      {subAba === 'relatorio' && (
        <section className="card card-pad space-y-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="section-title flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <FileText size={15} />
              </span>
              Relatório da Reunião
            </h3>
            {relatorioAtual && (
              <span className={relatorioAtual.status === 'FECHADO' ? 'badge-red' : 'badge-emerald'}>
                Status: {relatorioAtual.status}
              </span>
            )}
          </div>

          <form onSubmit={handleCriarRelatorio} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="label">Data da Reunião</label>
                <input
                  type="date"
                  required
                  disabled={relatorioAtual?.status === 'FECHADO'}
                  value={dataRelatorio}
                  onChange={(e) => setDataRelatorio(e.target.value)}
                  className="input disabled:opacity-50"
                />
              </div>

              <div>
                <label className="label">Total de Presentes</label>
                <input
                  type="number"
                  min="0"
                  required
                  disabled={relatorioAtual?.status === 'FECHADO'}
                  value={presentes}
                  onChange={(e) => setPresentes(Number(e.target.value))}
                  className="input disabled:opacity-50"
                />
              </div>

              <div>
                <label className="label">Visitantes</label>
                <input
                  type="number"
                  min="0"
                  required
                  disabled={relatorioAtual?.status === 'FECHADO'}
                  value={totalVisitantes}
                  onChange={(e) => setTotalVisitantes(Number(e.target.value))}
                  className="input disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label className="label">Observações e Pedidos de Oração</label>
              <textarea
                rows={3}
                disabled={relatorioAtual?.status === 'FECHADO'}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex: Tivemos 2 decisões de fé e 1 testemunho de cura..."
                className="input disabled:opacity-50"
              />
            </div>

            {/* BOTÃO CÂMERA DO CELULAR */}
            <div>
              <label className="label">Foto da Célula (Obrigatória na reunião)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFotoChange}
                className="hidden"
                disabled={relatorioAtual?.status === 'FECHADO'}
              />

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={relatorioAtual?.status === 'FECHADO'}
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-ghost"
                >
                  <Camera size={16} />
                  Tirar Foto pelo Celular
                </button>
                {fotoBase64 && (
                  <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
                    <Check size={14} />
                    Foto capturada pronta para envio
                  </span>
                )}
              </div>

              {fotoBase64 && (
                <div className="mt-3 w-32 h-24 rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                  <img src={fotoBase64} alt="Foto da Célula" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            <div className="pt-3 flex flex-col sm:flex-row gap-3">
              {(!relatorioAtual || relatorioAtual.status === 'ABERTO') && (
                <button type="submit" disabled={enviando} className="btn-primary flex-1">
                  {enviando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {enviando ? 'Gravando relatório...' : 'Salvar Relatório Semanal'}
                </button>
              )}

              {relatorioAtual && relatorioAtual.status === 'ABERTO' && (
                <button type="button" onClick={handleFecharRelatorio} className="btn-danger">
                  <Lock size={16} />
                  Fechar Relatório Definitivamente
                </button>
              )}
            </div>
          </form>
        </section>
      )}

      {/* ABA: MEMBROS & VISITANTES */}
      {subAba === 'membros' && (
        <section className="space-y-5">
          <div className="card card-pad">
            <h3 className="section-title mb-4">Cadastrar Novo Membro</h3>
            <form onSubmit={handleCadastrarMembro} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                required
                placeholder="Nome completo do membro"
                value={nomeNovoMembro}
                onChange={(e) => setNomeNovoMembro(e.target.value)}
                className="input"
              />
              <input
                type="text"
                placeholder="Telefone / WhatsApp"
                value={telefoneNovoMembro}
                onChange={(e) => setTelefoneNovoMembro(e.target.value)}
                className="input"
              />
              <button type="submit" className="btn-primary justify-center">
                <UserPlus size={16} />
                Adicionar Membro
              </button>
            </form>
          </div>

          <div className="card card-pad">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="section-title flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                  <Users size={15} />
                </span>
                Membros Cadastrados
              </h3>
              <span className="badge-blue">{membros.length}</span>
            </div>
            <div className="divide-y divide-slate-800">
              {membros.map((m) => (
                <div key={m.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-9 h-9 shrink-0 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center text-xs font-bold">
                      {m.nome ? m.nome.charAt(0).toUpperCase() : ''}
                    </span>
                    <div className="min-w-0">
                      <span className="text-sm font-semibold text-white block truncate">{m.nome}</span>
                      {m.telefone && (
                        <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <Phone size={11} className="shrink-0" />
                          {m.telefone}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="badge-emerald">Ativo</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card card-pad">
            <h3 className="section-title mb-4">Cadastrar Novo Visitante</h3>
            <form onSubmit={handleCadastrarVisitante} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                required
                placeholder="Nome do visitante"
                value={nomeNovoVisitante}
                onChange={(e) => setNomeNovoVisitante(e.target.value)}
                className="input"
              />
              <input
                type="text"
                placeholder="Telefone / WhatsApp"
                value={telefoneNovoVisitante}
                onChange={(e) => setTelefoneNovoVisitante(e.target.value)}
                className="input"
              />
              <button type="submit" className="btn-primary justify-center">
                <UserPlus size={16} />
                Adicionar Visitante
              </button>
            </form>
          </div>

          <div className="card card-pad">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="section-title flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                  <UserPlus size={15} />
                </span>
                Visitantes Registrados
              </h3>
              <span className="badge-indigo">{visitantes.length}</span>
            </div>
            {visitantes.length === 0 ? (
              <div className="empty-state border-0 bg-transparent p-6">
                <Inbox size={22} className="mx-auto mb-2 text-slate-600" />
                Nenhum visitante registrado ainda.
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {visitantes.map((v) => (
                  <div key={v.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-9 h-9 shrink-0 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-xs font-bold">
                        {v.nome ? v.nome.charAt(0).toUpperCase() : ''}
                      </span>
                      <div className="min-w-0">
                        <span className="text-sm font-semibold text-white block truncate">{v.nome}</span>
                        {v.telefone && (
                          <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                            <Phone size={11} className="shrink-0" />
                            {v.telefone}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="badge-blue">Visitante</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default CelulaView;
