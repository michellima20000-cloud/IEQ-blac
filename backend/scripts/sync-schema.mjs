import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
const raizBackend = resolve(aqui, '..');
const limiteMs = Number(process.env.SCHEMA_SYNC_TIMEOUT_MS || 120000);

export function sincronizarSchema() {
  return new Promise((resolvePromise) => {
    if (!process.env.DATABASE_URL) {
      console.warn('[schema] DATABASE_URL ausente: sincronização ignorada.');
      resolvePromise({ ok: false, motivo: 'DATABASE_URL ausente' });
      return;
    }

    const comando = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const filho = spawn(comando, ['prisma', 'db', 'push', '--accept-data-loss', '--skip-generate'], {
      cwd: raizBackend,
      env: process.env,
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let saida = '';
    const coletar = (chunk) => {
      saida += chunk.toString();
      if (saida.length > 4000) saida = saida.slice(-4000);
    };
    filho.stdout?.on('data', coletar);
    filho.stderr?.on('data', coletar);

    const timer = setTimeout(() => {
      console.error('[schema] Tempo esgotado: encerrando sincronização.');
      try { filho.kill('SIGKILL'); } catch { /* ignore */ }
    }, limiteMs);

    filho.on('error', (err) => {
      clearTimeout(timer);
      console.error('[schema] Erro ao iniciar o prisma db push:', err.message);
      resolvePromise({ ok: false, motivo: err.message });
    });

    filho.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        console.log('[schema] Schema do banco sincronizado com sucesso.');
        resolvePromise({ ok: true });
      } else {
        console.error(`[schema] Falha na sincronização (código ${code}): ${saida.slice(-800)}`);
        resolvePromise({ ok: false, motivo: saida.slice(-400) });
      }
    });
  });
}

const executadoDireto = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (executadoDireto) {
  const resultado = await sincronizarSchema();
  process.exit(resultado.ok ? 0 : 0);
}
