import express, { Request, Response } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { ENV } from './config/env.ts';
import { swaggerSpec } from './config/swagger.ts';
import { globalRateLimiter } from './middlewares/rateLimiter.ts';
import { errorHandler } from './middlewares/errorHandler.ts';
import v1Router from './routes.ts';

const app = express();

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

// Endpoint facilitador para inicializar/reparar banco no Render
app.get('/api/v1/setup-db', async (_req: Request, res: Response) => {
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
      slug: 'ieq-sede'
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
  app.listen(ENV.PORT, async () => {
    console.log(`🚀 API IEQ rodando em http://localhost:${ENV.PORT}`);
    console.log(`📖 Documentação Swagger em http://localhost:${ENV.PORT}/api/v1/docs`);

    // Sincronização automática do schema e seed se conectado ao banco
    try {
      if (process.env.DATABASE_URL) {
        const { execSync } = await import('child_process');
        console.log('🔄 Sincronizando tabelas com o banco de dados...');
        try {
          execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
        } catch (e: any) {
          console.warn('Aviso no db push:', e.message);
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
    } catch (err: any) {
      console.warn('⚠️  Aviso na verificação de banco/seed:', err.message);
    }
  });
}

export default app;
