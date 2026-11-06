import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Rotas da API
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'Backend IEQ-black operando com sucesso!',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/info', (_req: Request, res: Response) => {
  res.json({
    name: 'IEQ-black API',
    version: '1.0.0',
    description: 'Serviço de Backend para o projeto IEQ'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor IEQ-black rodando em http://localhost:${PORT}`);
});
