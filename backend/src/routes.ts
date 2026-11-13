import { Router } from 'express';
import authRoutes from './modules/auth/auth.routes.ts';
import usuariosRoutes from './modules/usuarios/usuarios.routes.ts';
import celulasRoutes from './modules/celulas/celulas.routes.ts';
import midiaRoutes from './modules/midia/midia.routes.ts';
import visualPublicoRoutes from './modules/midia/visual.publico.routes.ts';
import vitrinePublicoRoutes from './modules/midia/vitrine.publico.routes.ts';
import arquivoPublicoRoutes from './modules/midia/arquivo.publico.routes.ts';
import adminRoutes from './modules/admin/admin.routes.ts';

const v1Router = Router();

// Rotas públicas (sem autenticação) ANTES dos routers que exigem token:
// o router de células usa authMiddleware para TODOS os caminhos, então
// qualquer rota pública precisa vir antes dele.
v1Router.use('/', visualPublicoRoutes);
v1Router.use('/', vitrinePublicoRoutes);
v1Router.use('/', arquivoPublicoRoutes);
v1Router.use('/admin', adminRoutes);
v1Router.use('/auth', authRoutes);
v1Router.use('/usuarios', usuariosRoutes);
v1Router.use('/', celulasRoutes);
v1Router.use('/', midiaRoutes);

export default v1Router;
