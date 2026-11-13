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
app.use(globalRateLimiter);
// Gzip: listas de mídia/relatórios carregam imagens em base64 (MBs);
// sem compressão o payload fica pesado e lento em conexões móveis.
app.use(compression());
app.use(express.json({ limit: '75mb' }));

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

app.get('/api/v1/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    api: 'v1',
    docs: '/api/v1/docs',
    timestamp: new Date().toISOString()
  });
});

// Endpoint facilitador para inicializar/reparar banco no Render.
// Protegido pelo segredo de manutenção (SETUP_SECRET) — sem ele a rota fica
// desabilitada, porque o seed apaga todos os dados do banco.
app.get('/api/v1/setup-db', exigirSegredoManutencao, async (_req: Request, res: Response) => {
  try {
    const { execSync } = await import('child_process');
    console.log('🔄 Executando prisma db push...');
    execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });

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

// 6. Tratamento padronizado de erros e logs estruturados
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(ENV.PORT, () => {
    console.log(`🚀 API IEQ rodando em http://localhost:${ENV.PORT}`);
    console.log(`📖 Documentação Swagger em http://localhost:${ENV.PORT}/api/v1/docs`);

    // Tarefas de inicialização em background: nunca devem impedir o servidor de subir
    (async () => {
      // Sincronização automática do schema e seed se conectado ao banco
      try {
        if (process.env.DATABASE_URL) {
          try {
            const { execSync } = await import('child_process');
            console.log('🔄 Sincronizando tabelas com o banco de dados...');
            execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
          } catch (e: any) {
            console.warn('Aviso no db push:', e?.message || e);
          }
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
    (async () => {
      try {
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
  });
}

export default app;
