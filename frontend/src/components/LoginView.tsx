import React, { useState } from 'react';
import { Church, Mail, Lock, KeyRound, ArrowRight, CircleAlert, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [slugIgreja, setSlugIgreja] = useState('ieq-sede');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    try {
      await login(email, senha, slugIgreja);
    } catch (err: any) {
      setErro(err.message || 'Falha ao autenticar. Verifique seus dados.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen text-slate-100 flex items-center justify-center p-4">
      {/* Glow decorativo */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[560px] h-[560px] rounded-full bg-blue-600/15 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[380px] h-[380px] rounded-full bg-indigo-600/10 blur-[110px]" />
      </div>

      <div className="w-full max-w-md card p-6 sm:p-8 relative animate-fade-up shadow-card">
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-600/30 mb-4">
            <Church size={26} className="text-white" />
          </div>
          <span className="badge-blue mb-3 inline-flex">Sistema da Igreja</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">IEQ Conecta</h1>
          <p className="text-slate-400 text-sm mt-1.5 text-balance">
            Acesse sua conta para gerenciar células, relatórios e mídias
          </p>
        </div>

        {erro && (
          <div className="mb-5 alert-error justify-start">
            <CircleAlert size={16} className="shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Identificador da Igreja (Slug)</label>
            <div className="relative">
              <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                required
                value={slugIgreja}
                onChange={(e) => setSlugIgreja(e.target.value)}
                placeholder="Ex: ieq-sede"
                className="input pl-10"
              />
            </div>
          </div>

          <div>
            <label className="label">Seu E-mail</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exemplo@ieq.com"
                className="input pl-10"
              />
            </div>
          </div>

          <div>
            <label className="label">Sua Senha</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                className="input pl-10"
              />
            </div>
          </div>

          <button type="submit" disabled={carregando} className="btn-primary w-full py-3 mt-1">
            {carregando ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Entrando...
              </>
            ) : (
              <>
                Entrar no Sistema
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-800/80 text-center text-[11px] text-slate-500">
          Acesso seguro com criptografia e isolamento por congregação
        </div>
      </div>
    </div>
  );
};

export default LoginView;
