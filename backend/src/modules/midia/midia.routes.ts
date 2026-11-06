import { Router } from 'express';
import { MidiaController } from './midia.controller.ts';
import { authMiddleware } from '../../middlewares/auth.ts';
import { tenantMiddleware } from '../../middlewares/tenant.ts';
import { requirePerfil } from '../../middlewares/rbac.ts';
import { validate } from '../../middlewares/validate.ts';
import {
  criarMidiaSchema,
  atualizarMidiaSchema,
  devolverMidiaSchema,
  criarEventoSchema,
  atualizarEventoSchema,
  personalizacaoVisualSchema
} from './midia.schemas.ts';

const router = Router();

router.use(authMiddleware);
router.use(tenantMiddleware);

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
router.post('/midia', validate(criarMidiaSchema), MidiaController.criar);
router.patch('/midia/:id', validate(atualizarMidiaSchema), MidiaController.atualizarEReenviar);

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
