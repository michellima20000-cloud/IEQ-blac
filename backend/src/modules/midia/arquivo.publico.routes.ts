import { Router } from 'express';
import { MidiaController } from './midia.controller.ts';

const router = Router();

/**
 * Arquivo do conteúdo de mídia (vídeo enviado para a vitrine).
 *
 * Fica num router PRÓPRIO (montado antes dos routers com autenticação) porque
 * o conteúdo PUBLICADO é público: é o arquivo que a vitrine compartilhável
 * mostra sem login. Conteúdo pendente/devolvido só é servido para usuário
 * da mesma igreja (header Bearer ou ?token=).
 */
router.get('/midia/:id/arquivo', MidiaController.servirArquivo);

export default router;
