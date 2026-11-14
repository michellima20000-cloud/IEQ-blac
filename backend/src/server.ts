import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import { ENV } from './config/env.ts';
import { swaggerSpec } from './config/swagger.ts';
import { globalRateLimiter } from './middlewares/rateLimiter.ts';
import { errorHandler } from './middlewares/errorHandler.ts';
import { exigirSegredoManutencao } from './middlewares/setupSecret.ts';
import { QueueManager } from './jobs/queues.ts';
import v1Router from './routes.ts';

const app = express();

// A Render fica atrás de um proxy: sem isto, TODOS os usuários contam como
// um único IP no rate limiter e a API devolve 429 para todo mundo.
app.set('trust proxy', 1);

// 1. CORS - aceita localhost, FRONTEND_URL e qualquer domínio .vercel.app / .onrender.com
const ORIGENS_PERMITIDAS = [
  ENV.FRONTEND_URL,
  'http://localhost',
  'http://localhost:3000',
  'http://localhost:5173',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // curl, mobile PWA, testes
    const permitido =
      ORIGENS_PERMITIDAS.includes(origin) ||
      origin.startsWith('http://localhost:') ||
      origin.endsWith('.vercel.app') ||
      origin.endsWith('.onrender.com') ||
      origin.endsWith('.netlify.app');
    if (permitido) {
      callback(null, true);
    } else {
      callback(new Error(`CORS bloqueado: ${origin}`));
    }
  },
  credentials: true
}));

// 2. Middlewares essenciais
app.disable('x-powered-by');
app.use(globalRateLimiter);
// Gzip: respostas JSON/listas ficam menores em conexões móveis.
app.use(compression({ threshold: 1024 }));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));

// 3. Documentação Swagger/OpenAPI
app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// 4. Endpoint de integridade /health
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/v1/health', async (_req: Request, res: Response) => {
  let database = 'unknown';
  try {
    const { prisma } = await import('./config/prisma.ts');
    await prisma.$queryRaw`SELECT 1`;
    database = 'ok';
  } catch (e: any) {
    database = 'error';
  }
  res.json({
    status: 'ok',
    version: '1.0.0',
    api: 'v1',
    database,
    uptime: Math.round(process.uptime()),
    pid: process.pid,
    docs: '/api/v1/docs',
    timestamp: new Date().toISOString()
  });
});

// Diagnóstico detalhado do banco: mostra em quais tabelas o schema diverge.
// Retorna apenas contagens e mensagens de erro (nenhum dado sensível).
app.get('/api/v1/health/detalhe', async (_req: Request, res: Response) => {
  const checks: Record<string, unknown> = {};
  let status = 'ok';
  try {
    const { prisma } = await import('./config/prisma.ts');
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.conexao = 'ok';
    } catch (e: any) {
      checks.conexao = { erro: e?.code || '', mensagem: String(e?.message || e).slice(0, 300) };
      status = 'erro';
    }
    for (const [nome, fn] of [
      ['igrejas', () => prisma.igreja.count()],
      ['usuarios', () => prisma.usuario.count()],
      ['celulas', () => prisma.celula.count()]
    ] as Array<[string, () => Promise<number>]>) {
      try {
        checks[nome] = await fn();
      } catch (e: any) {
        checks[nome] = { erro: e?.code || '', mensagem: String(e?.message || e).slice(0, 300) };
        status = 'erro';
      }
    }
  } catch (e: any) {
    status = 'erro';
    checks.erroGeral = String(e?.message || e).slice(0, 300);
  }
  res.json({ status, checks, timestamp: new Date().toISOString() });
});

// Sincroniza o schema do Prisma SEM apagar dados (seguro para produção).
// Protected pelo segredo de manutenção (SETUP_SECRET).
app.post('/api/v1/setup-db/sync', exigirSegredoManutencao, async (_req: Request, res: Response) => {
  try {
    const { sincronizarSchema } = await import('../scripts/sync-schema.mjs');
    const resultado = await sincronizarSchema();
    if (!resultado.ok) {
      res.status(500).json({
        status: 'error',
        message: resultado.motivo || 'Falha ao sincronizar o schema do banco.'
      });
      return;
    }
    res.json({ status: 'ok', message: 'Schema do banco sincronizado com sucesso.' });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      message: err?.message || 'Falha ao sincronizar o schema do banco.'
    });
  }
});

// Endpoint facilitador para inicializar/reparar banco no Render.
// Protegido pelo segredo de manutenção (SETUP_SECRET) — sem ele a rota fica
// desabilitada, porque o seed apaga todos os dados do banco.
// ATENÇÃO: o seed recria os dados iniciais. Use /setup-db/sync para apenas
// sincronizar o schema sem tocar nos dados.
app.get('/api/v1/setup-db', exigirSegredoManutencao, async (_req: Request, res: Response) => {
  try {
    const { sincronizarSchema } = await import('../scripts/sync-schema.mjs');
    const resultado = await sincronizarSchema();
    if (!resultado.ok) {
      res.status(500).json({
        status: 'error',
        message: resultado.motivo || 'Falha ao sincronizar o schema do banco.'
      });
      return;
    }

    console.log('🌱 Executando seed...');
    const { main: runSeed } = await import('../prisma/seed.ts');
    await runSeed();

    res.json({
      status: 'ok',
      message: 'Banco sincronizado e Seed criado com sucesso! Usuários e igreja prontos para login.',
      pastor: 'pastor@ieq.com',
      slug: 'ieq-cidade-nova'
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      message: err.message || 'Falha ao executar setup do banco.'
    });
  }
});

// 5. Rotas versionadas em /api/v1
app.use('/api/v1', v1Router);

// Rota raiz (healthcheck alternativo caso o Render esteja apontando para "/")
app.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'ok', api: 'ieq-black', timestamp: new Date().toISOString() });
});

// 6. Tratamento padronizado de erros e logs estruturados
app.use(errorHandler);

// Diagnóstico de boot: evita saída silenciosa e registra falhas não tratadas
process.on('unhandledRejection', (reason: any) => {
  console.error('[fatal] unhandledRejection:', reason?.stack || reason?.message || reason);
});
process.on('uncaughtException', (err: any) => {
  console.error('[fatal] uncaughtException:', err?.stack || err?.message || err);
});
console.log('[boot] módulos carregados, preparando listen...');

if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(ENV.PORT, () => {
    console.log(`🚀 API IEQ rodando em http://localhost:${ENV.PORT}`);
    console.log(`📖 Documentação Swagger em http://localhost:${ENV.PORT}/api/v1/docs`);

    // Tarefas de inicialização em background: nunca devem impedir o servidor de subir
    (async () => {
      // Sincronização automática do schema e seed se conectado ao banco
      try {
        if (process.env.DATABASE_URL && process.env.NODE_ENV !== 'production') {
          // Sincronização NÃO bloqueante: usar execSync aqui travava o event
          // loop e o Render matava a instância (conexão fechada / 500).
          // Em produção a sincronização acontece na FASE DE BUILD (Render),
          // porque subir o CLI do Prisma junto com a API estoura a memória
          // da instância gratuita (512 MB) e derruba o serviço.
          try {
            const { sincronizarSchema } = await import('../scripts/sync-schema.mjs');
            const resultado = await sincronizarSchema();
            if (!resultado.ok) {
              console.error('[setup] Não foi possível sincronizar o schema do banco:', resultado.motivo);
            }
          } catch (e: any) {
            console.error('[setup] Falha na sincronização do schema:', e?.message || e);
          }
        } else if (process.env.NODE_ENV === 'production') {
          console.log('[setup] Produção: schema sincronizado na fase de build (POST /api/v1/setup-db/sync sincroniza manualmente).');
        }

        const { prisma } = await import('./config/prisma.ts');
        const totalIgrejas = await prisma.igreja.count();
        if (totalIgrejas === 0) {
          console.log('🌱 Banco vazio detectado. Criando dados iniciais da IEQ...');
          const { main: runSeed } = await import('../prisma/seed.ts');
          await runSeed();
          console.log('✅ Seed inicial da IEQ concluído com sucesso!');
        }

        // Migração do identificador (slug) da igreja principal:
        // "ieq-sede" -> "ieq-cidade-nova" (mantém o mesmo id, logo todos os dados ficam).
        try {
          const alvo = await prisma.igreja.findUnique({ where: { slug: 'ieq-cidade-nova' } });
          if (!alvo) {
            const antiga = await prisma.igreja.findUnique({ where: { slug: 'ieq-sede' } });
            if (antiga) {
              await prisma.igreja.update({
                where: { id: antiga.id },
                data: { slug: 'ieq-cidade-nova', nome: 'IEQ Cidade Nova' }
              });
              console.log('🔄 Identificador da igreja migrado para "ieq-cidade-nova" (IEQ Cidade Nova).');
            }
          } else if (alvo.nome !== 'IEQ Cidade Nova') {
            await prisma.igreja.update({ where: { id: alvo.id }, data: { nome: 'IEQ Cidade Nova' } });
            console.log('🔄 Nome da igreja atualizado para "IEQ Cidade Nova".');
          }
        } catch (e: any) {
          console.warn('Aviso na migração do identificador da igreja:', e?.message || e);
        }

        // Migração das mídias da vitrine: fotos que ainda estavam guardadas
        // como texto base64 passam a ficar gravadas no banco como bytes
        // (tabela midia_arquivo_partes), igual aos vídeos.
        try {
          const { MidiaService } = await import('./modules/midia/midia.service.ts');
          const { VisualService } = await import('./modules/midia/visual.service.ts');
          const migrados = await MidiaService.migrarArquivosLegados();
          if (migrados > 0) {
            console.log(`🔄 ${migrados} mídia(s) da vitrine migradas para bytes no banco.`);
          }
          const logos = await VisualService.migrarLogosLegados();
          if (logos > 0) {
            console.log(`🔄 ${logos} logo(s) migrado(s) para bytes no banco.`);
          }
        } catch (e: any) {
          console.warn('Aviso na migração das mídias da vitrine:', e?.message || e);
        }
      } catch (err: any) {
        console.warn('⚠️  Aviso na verificação de banco/seed:', err?.message || err);
      }
    })().catch((err) => console.warn('⚠️  Falha em tarefas de inicialização:', err?.message || err));

    // Rotina de backup diário: roda 1x no boot (o histórico fica em memória,
    // então cada restart precisa registrar um backup novo) e depois a cada 24h.
    // Sem isso o painel do pastor exibe o alerta "Nenhum backup do sistema
    // foi localizado nas últimas 48 horas".
    // Em produção o backup automático fica DESLIGADO por padrão: o dump do
    // banco consome CPU/memória e derrubava a instância gratuita do Render.
    // Habilite com BACKUP_AUTOMATICO=true.
    if (process.env.BACKUP_AUTOMATICO === 'true') {
      (async () => {
        try {
          // Espera o servidor estabilizar antes de gerar o dump (evita competir
          // memória/CPU com as primeiras requisições na instância gratuita).
          await new Promise((r) => setTimeout(r, 30000));
          await QueueManager.runRotinaDiariaGlobal();
          setInterval(() => {
            QueueManager.runRotinaDiariaGlobal().catch((e: any) =>
              console.error('[Manutenção] Falha na rotina diária:', e.message)
            );
          }, 24 * 60 * 60 * 1000);
        } catch (err: any) {
          console.error('[Manutenção] Falha no backup inicial:', err?.message || err);
        }
      })();
    } else {
      console.log('[boot] Backup automático desativado (defina BACKUP_AUTOMATICO=true para habilitar).');
    }

    // Monitor de memória: ajuda a identificar vazamentos/OOM no Render.
    const monitorMemoria = setInterval(() => {
      const uso = process.memoryUsage();
      console.log(
        `[mem] rss=${Math.round(uso.rss / 1024 / 1024)}MB heap=${Math.round(uso.heapUsed / 1024 / 1024)}MB uptime=${Math.round(process.uptime())}s`
      );
    }, 60000);
    monitorMemoria.unref?.();
  });

  server.on('error', (err: any) => {
    console.error('[boot] Erro no listener HTTP:', err?.message || err);
  });

  // Timeouts explícitos: evitam que requisições lentas fiquem penduradas
  // até o Render encerrar a conexão.
  server.requestTimeout = 180000;
  server.headersTimeout = 65000;
  server.keepAliveTimeout = 60000;
}

export default app;
