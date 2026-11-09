import { Router } from 'express';
import { CelulasController } from './celulas.controller.ts';
import { authMiddleware } from '../../middlewares/auth.ts';
import { tenantMiddleware } from '../../middlewares/tenant.ts';
import { validate } from '../../middlewares/validate.ts';
import {
  criarMembroSchema,
  atualizarMembroSchema,
  criarVisitanteSchema,
  criarRelatorioSchema,
  atualizarRelatorioSchema
} from './celulas.schemas.ts';

const router = Router();

router.use(authMiddleware);
router.use(tenantMiddleware);

// --- CÉLULA DO USUÁRIO ---
router.get('/celulas/minha', CelulasController.obterMinhaCelula);
router.get('/celulas', CelulasController.listarTodasCelulas);
router.get('/redes', CelulasController.listarTodasRedes);

// --- MEMBROS ---
/**
 * @swagger
 * /celulas/{celulaId}/membros:
 *   post:
 *     summary: Cadastra membro na célula (Líder da Célula ou Pastor)
 *     tags: [Módulo de Células]
 *     security:
 *       - BearerAuth: []
 */
router.post('/celulas/:celulaId/membros', validate(criarMembroSchema), CelulasController.criarMembro);
router.patch('/celulas/:celulaId/membros/:id', validate(atualizarMembroSchema), CelulasController.atualizarMembro);
router.get('/celulas/:celulaId/membros', CelulasController.listarMembros);

// --- VISITANTES ---
router.post('/celulas/:celulaId/visitantes', validate(criarVisitanteSchema), CelulasController.criarVisitante);
router.get('/celulas/:celulaId/visitantes', CelulasController.listarVisitantes);

// --- RELATÓRIOS SEMANAIS ---
router.post('/celulas/:celulaId/relatorios', validate(criarRelatorioSchema), CelulasController.criarRelatorio);
router.patch('/relatorios/:id', validate(atualizarRelatorioSchema), CelulasController.atualizarRelatorio);
router.post('/relatorios/:id/fechar', CelulasController.fecharRelatorio);
router.delete('/relatorios/:id', validate(atualizarRelatorioSchema), CelulasController.excluirRelatorio);
router.get('/relatorios/:id/foto', CelulasController.visualizarFoto);

// --- CONSOLIDADO DA REDE (LÍDER DE REDE) ---
router.get('/redes/minha', CelulasController.obterMinhaRede);
router.get('/redes/:redeId/consolidado', CelulasController.consolidadoRede);

// --- DASHBOARD (PASTOR) ---
router.get('/dashboard/pastor', CelulasController.dashboardPastor);

export default router;

