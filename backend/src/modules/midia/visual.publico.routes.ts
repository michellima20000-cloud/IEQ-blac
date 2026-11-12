import { Router } from 'express';
import { VisualService } from './visual.service.ts';
import { candidatosSlug } from '../../utils/slug.ts';

const router = Router();

/**
 * Endpoint público (sem autenticação): identidade visual por slug da igreja.
 * Usado pela tela de login para exibir o logo da igreja antes da sessão existir.
 */
router.get('/publico/visual/:slug', async (req, res, next) => {
  try {
    let visual = null;
    for (const candidato of candidatosSlug(String(req.params.slug || ''))) {
      visual = await VisualService.obterPorSlug(candidato);
      if (visual) break;
    }
    if (!visual) {
      return res.status(404).json({ error: 'NaoEncontrado', message: 'Igreja não encontrada.' });
    }
    return res.json({ visual });
  } catch (err) {
    return next(err);
  }
});

export default router;
