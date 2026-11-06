import { Router } from 'express';
import { AuthController } from './auth.controller.ts';
import { validate } from '../../middlewares/validate.ts';
import { loginSchema, refreshSchema } from './auth.schemas.ts';
import { authMiddleware } from '../../middlewares/auth.ts';
import { loginRateLimiter } from '../../middlewares/rateLimiter.ts';

const router = Router();

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Autentica o usuário e retorna o par de tokens (Access + Refresh)
 *     tags: [Autenticação]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, senha, slugIgreja]
 *             properties:
 *               email:
 *                 type: string
 *                 example: pastor@ieq.com
 *               senha:
 *                 type: string
 *                 example: senha123456
 *               slugIgreja:
 *                 type: string
 *                 example: ieq-sede
 *     responses:
 *       200:
 *         description: Login bem-sucedido
 *       401:
 *         description: Credenciais incorretas ou igreja inválida
 *       429:
 *         description: Muitas tentativas de login
 */
router.post('/login', loginRateLimiter, validate(loginSchema), AuthController.login);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Renova o Access Token utilizando um Refresh Token válido
 *     tags: [Autenticação]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Tokens renovados com sucesso
 *       401:
 *         description: Refresh token expirado ou inválido
 */
router.post('/refresh', validate(refreshSchema), AuthController.refresh);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Invalida a sessão e revoga o refresh token
 *     tags: [Autenticação]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Logout realizado com sucesso
 */
router.post('/logout', AuthController.logout);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Retorna as informações do usuário autenticado a partir do token
 *     tags: [Autenticação]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dados do usuário autenticado
 *       401:
 *         description: Não autenticado ou token expirado
 */
router.get('/me', authMiddleware, AuthController.me);

export default router;

