import React, { useEffect, useState, useRef } from 'react';
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

  // Formulário de Relatório
  const [dataRelatorio, setDataRelatorio] = useState(new Date().toISOString().split('T')[0]);
  const [presentes, setPresentes] = useState(10);
  const [totalVisitantes, setTotalVisitantes] = useState(2);
  const [observacoes, setObservacoes] = useState('');
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);
  const [relatorioAtual, setRelatorioAtual] = useState<any | null>(null);

  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const celulaId = usuario?.celulaId;

  useEffect(() => {
    if (celulaId) {
      carregarMembrosEVisitantes();
    }
  }, [celulaId]);

  const carregarMembrosEVisitantes = async () => {
    if (!celulaId) return;
    try {
      const [resM, resV] = await Promise.all([
        ApiClient.get(`/celulas/${celulaId}/membros`),
        ApiClient.get(`/celulas/${celulaId}/visitantes`)
      ]);
      setMembros(resM.membros || []);
      setVisitantes(resV.visitantes || []);
    } catch {
      // Ignora falha inicial
    }
  };

  const handleCadastrarMembro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!celulaId) return;
    setMensagemErro(null);

    try {
      await ApiClient.post(`/celulas/${celulaId}/membros`, {
        nome: nomeNovoMembro,
        telefone: telefoneNovoMembro
      });
      setNomeNovoMembro('');
      setTelefoneNovoMembro('');
      setMensagemSucesso('Membro cadastrado com sucesso!');
      carregarMembrosEVisitantes();
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
    if (!celulaId) return;
    setMensagemErro(null);
    setEnviando(true);

    try {
      const res = await ApiClient.post(`/celulas/${celulaId}/relatorios`, {
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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6">
        <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block mb-1">
          Área do Líder de Célula
        </span>
        <h2 className="text-xl sm:text-2xl font-bold text-white">Minha Célula</h2>
        <p className="text-slate-400 text-sm">Gerencie os membros da sua célula e envie o relatório semanal com foto</p>

        {/* Abas Sub-navegação */}
        <div className="flex gap-2 mt-4 pt-4 border-t border-slate-800">
          <button
            onClick={() => setSubAba('relatorio')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
              subAba === 'relatorio' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25' : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            📝 Relatório Semanal
          </button>
          <button
            onClick={() => setSubAba('membros')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
              subAba === 'membros' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25' : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            👥 Membros & Visitantes ({membros.length})
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

      {/* ABA: RELATÓRIO SEMANAL */}
      {subAba === 'relatorio' && (
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Relatório da Reunião</h3>
            {relatorioAtual && (
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                relatorioAtual.status === 'FECHADO'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}>
                Status: {relatorioAtual.status}
              </span>
            )}
          </div>

          <form onSubmit={handleCriarRelatorio} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Data da Reunião</label>
                <input
                  type="date"
                  required
                  disabled={relatorioAtual?.status === 'FECHADO'}
                  value={dataRelatorio}
                  onChange={(e) => setDataRelatorio(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Total de Presentes</label>
                <input
                  type="number"
                  min="0"
                  required
                  disabled={relatorioAtual?.status === 'FECHADO'}
                  value={presentes}
                  onChange={(e) => setPresentes(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Visitantes</label>
                <input
                  type="number"
                  min="0"
                  required
                  disabled={relatorioAtual?.status === 'FECHADO'}
                  value={totalVisitantes}
                  onChange={(e) => setTotalVisitantes(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Observações e Pedidos de Oração</label>
              <textarea
                rows={3}
                disabled={relatorioAtual?.status === 'FECHADO'}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex: Tivemos 2 decisões de fé e 1 testemunho de cura..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white disabled:opacity-50"
              />
            </div>

            {/* BOTÃO CÂMERA DO CELULAR */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">Foto da Célula (Obrigatória na reunião)</label>
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
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 border border-slate-700 disabled:opacity-50"
                >
                  <span>📷</span>
                  <span>Tirar Foto pelo Celular</span>
                </button>
                {fotoBase64 && (
                  <span className="text-xs text-emerald-400 font-medium">✓ Foto capturada pronta para envio</span>
                )}
              </div>

              {fotoBase64 && (
                <div className="mt-3 w-32 h-24 rounded-xl overflow-hidden border border-slate-700 bg-black">
                  <img src={fotoBase64} alt="Foto da Célula" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            <div className="pt-3 flex flex-col sm:flex-row gap-3">
              {(!relatorioAtual || relatorioAtual.status === 'ABERTO') && (
                <button
                  type="submit"
                  disabled={enviando}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm transition-colors shadow-lg shadow-emerald-600/25 disabled:opacity-50"
                >
                  {enviando ? 'Gravando relatório...' : 'Salvar Relatório Semanal'}
                </button>
              )}

              {relatorioAtual && relatorioAtual.status === 'ABERTO' && (
                <button
                  type="button"
                  onClick={handleFecharRelatorio}
                  className="py-3 px-6 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl text-sm transition-colors shadow-lg shadow-red-600/25"
                >
                  🔒 Fechar Relatório Definitivamente
                </button>
              )}
            </div>
          </form>
        </section>
      )}

      {/* ABA: MEMBROS & VISITANTES */}
      {subAba === 'membros' && (
        <section className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
            <h3 className="text-base font-bold text-white mb-3">Cadastrar Novo Membro</h3>
            <form onSubmit={handleCadastrarMembro} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                required
                placeholder="Nome completo do membro"
                value={nomeNovoMembro}
                onChange={(e) => setNomeNovoMembro(e.target.value)}
                className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
              />
              <input
                type="text"
                placeholder="Telefone / WhatsApp"
                value={telefoneNovoMembro}
                onChange={(e) => setTelefoneNovoMembro(e.target.value)}
                className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
              />
              <button
                type="submit"
                className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm"
              >
                + Adicionar Membro
              </button>
            </form>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
            <h3 className="text-base font-bold text-white mb-3">Membros Cadastrados ({membros.length})</h3>
            <div className="divide-y divide-slate-800">
              {membros.map((m) => (
                <div key={m.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold text-white block">{m.nome}</span>
                    {m.telefone && <span className="text-xs text-slate-400">{m.telefone}</span>}
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold">
                    Ativo
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 mt-4">
            <h3 className="text-base font-bold text-white mb-3">Visitantes Registrados ({visitantes.length})</h3>
            <div className="divide-y divide-slate-800">
              {visitantes.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">Nenhum visitante registrado ainda.</p>
              ) : (
                visitantes.map((v) => (
                  <div key={v.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold text-white block">{v.nome}</span>
                      {v.telefone && <span className="text-xs text-slate-400">{v.telefone}</span>}
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-semibold">
                      Visitante
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default CelulaView;

