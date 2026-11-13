import { Router } from 'express';
import { UsuariosController } from './usuarios.controller.ts';
import { authMiddleware } from '../../middlewares/auth.ts';
import { tenantMiddleware } from '../../middlewares/tenant.ts';
import { requirePerfil } from '../../middlewares/rbac.ts';
import { validate } from '../../middlewares/validate.ts';
import { criarUsuarioSchema, atualizarUsuarioSchema } from './usuarios.schemas.ts';

const router = Router();

// Todas as rotas de gestão de usuários exigem autenticação, tenant e perfil PASTOR
router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(requirePerfil('PASTOR', 'ADM'));

/**
 * @swagger
 * /usuarios:
 *   post:
 *     summary: Cadastra um novo usuário na igreja (Líder de Célula, Líder de Rede ou Mídia)
 *     description: Ação exclusiva do Pastor. Aplica isolamento automático pela igreja_id do token.
 *     tags: [Gestão de Usuários]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nome, email, senha, perfil]
 *             properties:
 *               nome:
 *                 type: string
 *               email:
 *                 type: string
 *               senha:
 *                 type: string
 *               perfil:
 *                 type: string
 *                 enum: [CELULA, REDE, MIDIA, ADM]
 *               redeId:
 *                 type: string
 *                 format: uuid
 *               celulaId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Usuário cadastrado com sucesso
 *       400:
 *         description: Dados inválidos ou e-mail já cadastrado
 *       403:
 *         description: Acesso negado (perfil não é Pastor)
 */
router.post('/', validate(criarUsuarioSchema), UsuariosController.criar);

/**
 * @swagger
 * /usuarios:
 *   get:
 *     summary: Lista todos os usuários cadastrados na igreja do Pastor
 *     tags: [Gestão de Usuários]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: perfil
 *         schema:
 *           type: string
 *           enum: [CELULA, REDE, PASTOR, MIDIA, ADM]
 *         description: Filtro opcional por perfil
 *     responses:
 *       200:
 *         description: Lista de usuários retornada
 *       403:
 *         description: Acesso negado
 */
router.get('/', UsuariosController.listar);

/**
 * @swagger
 * /usuarios/{id}:
 *   get:
 *     summary: Busca detalhes de um usuário da igreja
 *     tags: [Gestão de Usuários]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Dados do usuário
 *       404:
 *         description: Usuário não encontrado nesta igreja
 */
router.get('/:id', UsuariosController.buscarPorId);

/**
 * @swagger
 * /usuarios/{id}:
 *   patch:
 *     summary: Atualiza um usuário da igreja (nome, e-mail, senha, perfil, vínculos ou status)
 *     tags: [Gestão de Usuários]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *               email:
 *                 type: string
 *               senha:
 *                 type: string
 *               perfil:
 *                 type: string
 *                 enum: [CELULA, REDE, MIDIA, PASTOR, ADM]
 *               ativo:
 *                 type: boolean
 *               redeId:
 *                 type: string
 *               celulaId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Usuário atualizado
 *       404:
 *         description: Usuário não encontrado
 */
router.patch('/:id', validate(atualizarUsuarioSchema), UsuariosController.atualizar);

/**
 * @swagger
 * /usuarios/{id}:
 *   delete:
 *     summary: Exclui um usuário da igreja (ou o desativa se houver dados vinculados)
 *     description: Se o usuário possuir relatórios ou conteúdos de mídia vinculados, ele é apenas desativado para preservar o histórico. O pastor não pode excluir a própria conta.
 *     tags: [Gestão de Usuários]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Usuário excluído ou desativado
 *       400:
 *         description: "Operação inválida (ex: excluir o próprio usuário)"
 *       404:
 *         description: Usuário não encontrado
 */
router.delete('/:id', UsuariosController.excluir);

export default router;

