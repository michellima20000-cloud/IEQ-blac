import { Router } from 'express';
import multer from 'multer';
import { tmpdir } from 'node:os';
import { extname } from 'node:path';
import { MidiaController } from './midia.controller.ts';
import { authMiddleware } from '../../middlewares/auth.ts';
import { tenantMiddleware } from '../../middlewares/tenant.ts';
import { requirePerfil } from '../../middlewares/rbac.ts';
import { validate } from '../../middlewares/validate.ts';
import {
  atualizarMidiaSchema,
  devolverMidiaSchema,
  criarEventoSchema,
  atualizarEventoSchema,
  personalizacaoVisualSchema,
  retencaoFotosSchema
} from './midia.schemas.ts';

// Upload via multipart com o arquivo BINÁRIO (evita transformar um vídeo de
// 50 MB em ~66 MB de base64 dentro de um JSON, que travava a requisição).
// O arquivo vai para o DISCO (não para a memória): o vídeo é lido em pedaços
// de 4 MB e gravado no banco, então a API nunca segura o vídeo inteiro.
export const uploadMidia = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, tmpdir()),
    filename: (_req, file, cb) => {
      const extensao = extname(file.originalname || '').slice(0, 10).replace(/[^a-zA-Z0-9.]/g, '');
      cb(null, `ieq-midia-${Date.now()}-${Math.round(Math.random() * 1e9)}${extensao}`);
    }
  }),
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 10, // alterado de 1 para 10 — permite selecionar várias fotos de uma vez
    fields: 10,
    fieldSize: 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      return cb(null, true);
    }
    cb(new Error('Formato de arquivo não suportado. Envie imagem (JPG/PNG/WebP) ou vídeo (MP4/WebM).'));
  }
});

// O app envia o arquivo no campo "arquivo" (singular). A API e integrações
// antigas usam "arquivos" (plural). Aceitar os dois evita o erro
// "Unexpected file field" que quebrava todo o envio para a vitrine.
export const camposArquivo = [
  { name: 'arquivo', maxCount: 10 },
  { name: 'arquivos', maxCount: 10 }
];

const router = Router();

// A rota do arquivo do conteúdo (/midia/:id/arquivo) fica em
// src/modules/midia/arquivo.publico.routes.ts: ela precisa responder SEM
// login (vitrine compartilhável) e o router de células aplica
// authMiddleware em todos os caminhos.

router.use(authMiddleware);
router.use(tenantMiddleware);

// Traduz os erros do multer (arquivo muito grande, formato inválido) para 400
function comTratamentoDeUpload(req: any, res: any, next: any) {
  uploadMidia.fields(camposArquivo)(req, res, (err: any) => {
    if (!err) return next();
    const mensagem = err.code === 'LIMIT_FILE_SIZE'
      ? 'O arquivo excede o limite de 50 MB.'
      : err.code === 'LIMIT_UNEXPECTED_FILE'
        ? `Campo de arquivo inválido. Use "${camposArquivo.map((c) => c.name).join('" ou "')}".`
        : err.message || 'Falha no upload do arquivo.';
    res.status(400).json({ error: 'UploadInvalido', message: mensagem });
  });
}

// --- VITRINE & CONTEÚDOS ---
/**
 * @swagger
 * /midia/vitrine:
 *   get:
 *     summary: Vitrine pública com conteúdos publicados visíveis para todos os membros da igreja
 *     tags: [Módulo de Mídia]
 *     security:
 *       - BearerAuth: []
 */
router.get('/midia/vitrine', MidiaController.listarVitrine);
router.get('/midia/minhas', MidiaController.listarMinhas);
router.post('/midia', comTratamentoDeUpload, MidiaController.criar);
router.patch('/midia/:id', validate(atualizarMidiaSchema), MidiaController.atualizarEReenviar);
router.delete('/midia/:id', MidiaController.excluirMidia);

// --- FLUXO DE APROVAÇÃO (EXCLUSIVO DO PASTOR) ---
router.get('/midia/pendentes', requirePerfil('PASTOR', 'ADM'), MidiaController.listarPendentes);
router.post('/midia/:id/aprovar', requirePerfil('PASTOR', 'ADM'), MidiaController.aprovar);
router.post('/midia/:id/devolver', requirePerfil('PASTOR', 'ADM'), validate(devolverMidiaSchema), MidiaController.devolver);

// --- CALENDÁRIO ---
router.get('/calendario', MidiaController.listarEventos);
router.post('/calendario', validate(criarEventoSchema), MidiaController.criarEvento);
router.patch('/calendario/:id', validate(atualizarEventoSchema), MidiaController.atualizarEvento);
router.delete('/calendario/:id', MidiaController.excluirEvento);

// --- PERSONALIZAÇÃO VISUAL ---
router.get('/configuracoes/visual', MidiaController.obterVisual);
router.patch('/configuracoes/visual', validate(personalizacaoVisualSchema), MidiaController.atualizarVisual);

// --- RETENÇÃO DE FOTOS DOS RELATÓRIOS (PASTOR) ---
/**
 * @swagger
 * /configuracoes/retencao:
 *   get:
 *     summary: Prazo de retenção das fotos dos relatórios
 *     tags: [Configurações]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Prazo configurado em dias
 */
router.get('/configuracoes/retencao', requirePerfil('PASTOR', 'ADM'), MidiaController.obterRetencao);
router.patch(
  '/configuracoes/retencao',
  requirePerfil('PASTOR', 'ADM'),
  validate(retencaoFotosSchema),
  MidiaController.atualizarRetencao
);

export default router;

