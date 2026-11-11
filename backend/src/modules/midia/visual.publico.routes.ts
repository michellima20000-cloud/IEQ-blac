import { Router } from 'express';
import { VisualService } from './visual.service.ts';

const router = Router();

/**
 * Endpoint público (sem autenticação): identidade visual por slug da igreja.
 * Usado pela tela de login para exibir o logo da igreja antes da sessão existir.
 */
router.get('/publico/visual/:slug', async (req, res, next) => {
  try {
    const visual = await VisualService.obterPorSlug(String(req.params.slug || '').trim());
    if (!visual) {
      return res.status(404).json({ error: 'NaoEncontrado', message: 'Igreja não encontrada.' });
    }
    return res.json({ visual });
  } catch (err) {
    return next(err);
  }
});

export default router;
