import express, { Request, Response } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { ENV } from './config/env.ts';
import { swaggerSpec } from './config/swagger.ts';
import { globalRateLimiter } from './middlewares/rateLimiter.ts';
import { errorHandler } from './middlewares/errorHandler.ts';
import v1Router from './routes.ts';

const app = express();

// 1. CORS liberado somente para o domínio do front-end
app.use(cors({
  origin: (origin, callback) => {
    // Permite requisições sem origin (mobile PWA, curl, testes) ou que correspondam ao FRONTEND_URL
    if (!origin || origin === ENV.FRONTEND_URL || origin === 'http://localhost' || origin.startsWith('http://localhost:')) {
      callback(null, true);
    } else {
      callback(new Error('Bloqueado pelas políticas de CORS'));
    }
  },
  credentials: true
}));

// 2. Middlewares essenciais
app.use(globalRateLimiter);
app.use(express.json());

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

// 5. Rotas versionadas em /api/v1
app.use('/api/v1', v1Router);

// 6. Tratamento padronizado de erros e logs estruturados
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(ENV.PORT, () => {
    console.log(`🚀 API IEQ rodando em http://localhost:${ENV.PORT}`);
    console.log(`📖 Documentação Swagger em http://localhost:${ENV.PORT}/api/v1/docs`);
  });
}

export default app;
