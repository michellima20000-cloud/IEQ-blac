import React, { useState, useEffect } from 'react';
import { Mail, Lock, KeyRound, ArrowRight, CircleAlert, Loader2, Download, X, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ApiClient, fotoUtilizavel, urlMidia } from '../api/client';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [slugIgreja, setSlugIgreja] = useState('IEQ-CIDADE NOVA');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Carrega o logo da igreja (identidade visual) conforme o slug digitado
  useEffect(() => {
    // Aceita "IEQ-CIDADE NOVA", "IEQ Cidade Nova" ou "ieq-cidade-nova"
    const slug = slugIgreja
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\s_]+/g, '-');
    if (!slug) {
      setLogoUrl(null);
      return;
    }
    let cancelado = false;
    const t = setTimeout(async () => {
      try {
        const res: any = await ApiClient.get(`/publico/visual/${encodeURIComponent(slug)}`);
        const visual = res?.visual ?? res;
        const url = urlMidia(visual?.logoUrl ?? null);
        if (!cancelado) setLogoUrl(url && fotoUtilizavel(url) ? url : null);
      } catch {
        if (!cancelado) setLogoUrl(null);
      }
    }, 450);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [slugIgreja]);

  // Instalação PWA
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [appInstalado, setAppInstalado] = useState(false);
  const appInstaladoCheck =
    typeof window !== 'undefined' &&
    window.matchMedia('(display-mode: standalone)').matches;
  useEffect(() => {
    setAppInstalado(appInstaladoCheck);
  }, [appInstaladoCheck]);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!appInstalado) setShowInstallBanner(true);
    };
    const handlerInstalado = () => {
      setShowInstallBanner(false);
      setDeferredPrompt(null);
      setAppInstalado(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', handlerInstalado);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', handlerInstalado);
    };
  }, [appInstalado]);

  const instalarApp = () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((resultado: any) => {
      if (resultado.outcome === 'accepted') {
        setShowInstallBanner(false);
        setDeferredPrompt(null);
      }
    });
  };

  const handleEntrar = async () => {
    setErro(null);

    // Validação no app (sem submit nativo, o validador do navegador não roda)
    if (!slugIgreja.trim()) { setErro('Informe o identificador da igreja.'); return; }
    if (!email.trim()) { setErro('Informe o seu e-mail.'); return; }
    if (!senha) { setErro('Informe a sua senha.'); return; }

    setCarregando(true);

    try {
      await login(email, senha, slugIgreja);
    } catch (err: any) {
      setErro(err.message || 'Falha ao autenticar. Verifique seus dados.');
    } finally {
      setCarregando(false);
    }
  };

  /**
   * O envio NÃO usa o submit nativo do <form> (o Chrome dispara o aviso
   * "Verificar suas senhas" sempre que um formulário com senha é enviado).
   * O Enter é tratado aqui e o botão é type="button".
   */
  const handleTecla = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter' && !carregando) {
      e.preventDefault();
      void handleEntrar();
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
        <div className="text-center mb-7 relative">
          {/* Botão discreto de instalação PWA */}
          {showInstallBanner && !appInstalado && (
            <div className="absolute top-0 right-0">
              <button
                onClick={instalarApp}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 rounded text-xs text-blue-400"
              >
                <Download size={14} className="shrink-0" />
                Instalar app
              </button>
            </div>
          )}
          {appInstalado && showInstallBanner && (
            <div className="absolute top-0 right-0">
              <button
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-600/10 hover:bg-green-600/20 border border-green-500/30 rounded text-xs text-green-400"
              >
                <CheckCircle size={14} className="shrink-0" />
                App instalado
              </button>
            </div>
          )}
          {logoUrl && (
            <div className="flex justify-center mb-4">
              <img loading="lazy" decoding="async"
                src={logoUrl}
                alt="Logo da igreja"
                className="max-h-20 max-w-full object-contain drop-shadow-lg"
              />
            </div>
          )}
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

        <form
          onSubmit={(e) => e.preventDefault()}
          onKeyDown={handleTecla}
          autoComplete="on"
          className="space-y-4"
        >
          <div>
            <label className="label">Identificador da Igreja (Slug)</label>
            <div className="relative">
              <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                name="organizacao"
                autoComplete="organization"
                required
                value={slugIgreja}
                onChange={(e) => setSlugIgreja(e.target.value)}
                placeholder="Ex: ieq-cidade-nova"
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
                name="email"
                autoComplete="username"
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
                name="senha"
                autoComplete="current-password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                className="input pl-10"
              />
            </div>
          </div>

          <button type="button" onClick={() => void handleEntrar()} disabled={carregando} className="btn-primary w-full py-3 mt-1">
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
