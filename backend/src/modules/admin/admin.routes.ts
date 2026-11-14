import { Router } from 'express';
import { AdminController } from './admin.controller.ts';
import { authMiddleware } from '../../middlewares/auth.ts';
import { requirePerfil } from '../../middlewares/rbac.ts';
import { ENV } from '../../config/env.ts';
import { exigirSegredoManutencao } from '../../middlewares/setupSecret.ts';
import { prisma } from '../../config/prisma.ts';
import { validate } from '../../middlewares/validate.ts';
import { criarAdminUsuarioSchema, atualizarAdminUsuarioSchema, criarIgrejaSchema, atualizarIgrejaSchema } from './admin.schemas.ts';

const router = Router();

/**
 * Middleware para o bootstrap do primeiro ADM:
 * - Se SETUP_SECRET estiver definido: exige o segredo no header x-setup-secret.
 * - Se NÃO estiver definido (ex.: deploy novo): permite criar o PRIMEIRO ADM
 *   quando ainda não existir nenhum ADM no sistema (janela curta para desbloqueio
 *   sem precisar configurar variáveis de ambiente no painel do Render). Após
 *   existir um ADM, volta a exigir o segredo de manutenção.
 */
async function exigeSegredoOuPrimeiroAdm(req: any, res: any, next: any) {
  if (ENV.SETUP_SECRET) {
    return exigirSegredoManutencao(req, res, next);
  }

  const jaExisteAdm = await prisma.usuario.findFirst({ where: { perfil: 'ADM' } });
  if (jaExisteAdm) {
    return res.status(403).json({
      status: 'erro',
      message: 'Já existe um ADM no sistema. Use o segredo de manutenção (SETUP_SECRET) para esta rota.'
    });
  }

  next();
}

/**
 * @swagger
 * /admin/bootstrap:
 *   post:
 *     summary: Bootstrap do primeiro ADM (indisponível após existir um ADM no sistema)
 *     description: Exige o segredo de manutenção no header x-setup-secret.
 *     tags: [Administração]
 *     parameters:
 *       - in: header
 *         name: x-setup-secret
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               senha:
 *                 type: string
 *               nome:
 *                 type: string
 *               slugIgreja:
 *                 type: string
 *     responses:
 *       200:
 *         description: ADM criado ou promovido
 *       401:
 *         description: Segredo de manutenção inválido
 *       403:
 *         description: Já existe um ADM no sistema
 */
router.post('/bootstrap', exigeSegredoOuPrimeiroAdm, AdminController.bootstrapAdm);

// Todas as rotas administrativas: somente o DONO do sistema (ADMIN_OWNER_EMAILS) com perfil ADM
router.use(authMiddleware);
router.use((req: any, res: any, next: any) => {
  const email = String(req.user?.email || '').trim().toLowerCase();
  const donoOk = ENV.ADMIN_OWNER_EMAILS.length === 0 || ENV.ADMIN_OWNER_EMAILS.includes(email);
  if (req.user?.perfil !== 'ADM' || !donoOk) {
    return res.status(403).json({ error: 'AcessoNegado', message: 'Acesso restrito ao dono do sistema.' });
  }
  next();
});

/**
 * @swagger
 * /admin/sistema:
 *   get:
 *     summary: Resumo global do sistema (igrejas, totais, backup e armazenamento)
 *     description: Exclusivo do perfil ADM (superusuário, acesso a todas as igrejas).
 *     tags: [Administração]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Resumo do sistema
 *       403:
 *         description: Acesso restrito ao Administrador
 */
router.get('/sistema', AdminController.resumoSistema);

/**
 * @swagger
 * /admin/usuarios:
 *   get:
 *     summary: Lista usuários de todas as igrejas (filtros igrejaId e perfil)
 *     tags: [Administração]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: igrejaId
 *         schema:
 *           type: string
 *       - in: query
 *         name: perfil
 *         schema:
 *           type: string
 *           enum: [CELULA, REDE, PASTOR, MIDIA, ADM]
 *     responses:
 *       200:
 *         description: Lista de usuários
 */
router.get('/usuarios', AdminController.listarUsuarios);

/**
 * @swagger
 * /admin/usuarios:
 *   post:
 *     summary: Cria um usuário em qualquer igreja (igrejaId no corpo)
 *     tags: [Administração]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Usuário criado
 */
router.post('/usuarios', validate(criarAdminUsuarioSchema), AdminController.criarUsuario);

/**
 * @swagger
 * /admin/usuarios/{id}:
 *   patch:
 *     summary: Atualiza um usuário de qualquer igreja
 *     tags: [Administração]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Usuário atualizado
 */
router.patch('/usuarios/:id', validate(atualizarAdminUsuarioSchema), AdminController.atualizarUsuario);

/**
 * @swagger
 * /admin/usuarios/{id}:
 *   delete:
 *     summary: Exclui (ou desativa) um usuário de qualquer igreja
 *     tags: [Administração]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Usuário excluído ou desativado
 */
router.delete('/usuarios/:id', AdminController.excluirUsuario);

/**
 * @swagger
 * /admin/auditoria:
 *   get:
 *     summary: Logs de auditoria de todas as igrejas (query limite, padrão 100)
 *     tags: [Administração]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limite
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Logs de auditoria
 */
router.get('/auditoria', AdminController.listarAuditoria);

router.get('/igrejas', AdminController.listarIgrejas);
router.post('/igrejas', validate(criarIgrejaSchema), AdminController.criarIgreja);
router.patch('/igrejas/:id', validate(atualizarIgrejaSchema), AdminController.atualizarIgreja);
router.delete('/igrejas/:id', AdminController.excluirIgreja);

export default router;
