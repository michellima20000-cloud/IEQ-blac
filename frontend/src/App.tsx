import React from 'react';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl text-center">
        <span className="inline-block px-3 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full text-xs font-semibold uppercase tracking-wider mb-3">
          Etapa 1: Estrutura & PWA
        </span>
        <h1 className="text-2xl font-bold mb-2">IEQ - Sistema da Igreja</h1>
        <p className="text-slate-400 text-sm mb-6">
          Front-end PWA desacoplado, comunicando exclusivamente via API REST com o backend.
        </p>
        <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700/50 text-left text-xs font-mono text-slate-300">
          <div>Status: Estrutura inicial configurada</div>
          <div>API Endpoint: {import.meta.env.VITE_API_URL || 'http://localhost:3001'}</div>
        </div>
      </div>
    </div>
  );
}
