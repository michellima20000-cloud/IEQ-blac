import { Router } from 'express';
import multer from 'multer';
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
  personalizacaoVisualSchema
} from './midia.schemas.ts';

// Upload via multipart com o arquivo BINÁRIO (evita transformar um vídeo de
// 50 MB em ~66 MB de base64 dentro de um JSON, que travava a requisição)
const uploadMidia = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 1,
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

const router = Router();

router.use(authMiddleware);
router.use(tenantMiddleware);

// Traduz os erros do multer (arquivo muito grande, formato inválido) para 400
function comTratamentoDeUpload(req: any, res: any, next: any) {
  uploadMidia.single('arquivo')(req, res, (err: any) => {
    if (!err) return next();
    const mensagem = err.code === 'LIMIT_FILE_SIZE'
      ? 'O arquivo excede o limite de 50 MB.'
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
router.get('/midia/pendentes', requirePerfil('PASTOR'), MidiaController.listarPendentes);
router.post('/midia/:id/aprovar', requirePerfil('PASTOR'), MidiaController.aprovar);
router.post('/midia/:id/devolver', requirePerfil('PASTOR'), validate(devolverMidiaSchema), MidiaController.devolver);

// --- CALENDÁRIO ---
router.get('/calendario', MidiaController.listarEventos);
router.post('/calendario', validate(criarEventoSchema), MidiaController.criarEvento);
router.patch('/calendario/:id', validate(atualizarEventoSchema), MidiaController.atualizarEvento);
router.delete('/calendario/:id', MidiaController.excluirEvento);

// --- PERSONALIZAÇÃO VISUAL ---
router.get('/configuracoes/visual', MidiaController.obterVisual);
router.patch('/configuracoes/visual', validate(personalizacaoVisualSchema), MidiaController.atualizarVisual);

export default router;

