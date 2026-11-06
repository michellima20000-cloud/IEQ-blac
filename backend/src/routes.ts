import { Router } from 'express';
import authRoutes from './modules/auth/auth.routes.ts';
import usuariosRoutes from './modules/usuarios/usuarios.routes.ts';
import celulasRoutes from './modules/celulas/celulas.routes.ts';
import midiaRoutes from './modules/midia/midia.routes.ts';

const v1Router = Router();

v1Router.use('/auth', authRoutes);
v1Router.use('/usuarios', usuariosRoutes);
v1Router.use('/', celulasRoutes);
v1Router.use('/', midiaRoutes);

export default v1Router;
