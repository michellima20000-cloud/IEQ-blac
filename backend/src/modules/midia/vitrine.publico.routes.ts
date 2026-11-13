import { Router } from 'express';
import { cacheGet, cacheSet, chavesCache } from '../../config/upstash.ts';
import { VisualService } from './visual.service.ts';
import { VitrinePublicaService } from './vitrine.publico.service.ts';

const router = Router();

/**
 * Endpoint público (sem autenticação): vitrine da igreja pelo identificador (slug).
 * Usado para compartilhar o link /vitrine/ieq-cidade-nova com qualquer pessoa.
 * Regra: só conteúdo PUBLICADO é exposto.
 */
router.get('/publico/vitrine/:slug', async (req, res, next) => {
  try {
    const slug = String(req.params.slug || '');
    const igreja = await VitrinePublicaService.buscarIgreja(slug);

    if (!igreja || !igreja.ativa) {
      return res.status(404).json({ error: 'NaoEncontrado', message: 'Igreja não encontrada.' });
    }

    const chave = chavesCache.vitrinePublica(igreja.id);
    const emCache = await cacheGet<any>(chave);
    if (emCache) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      return res.json(emCache);
    }

    const [visual, publicacoes, eventos] = await Promise.all([
      VisualService.obterPorSlug(igreja.slug),
      VitrinePublicaService.listarPublicacoes(igreja.id),
      VitrinePublicaService.listarEventos(igreja.id)
    ]);

    const resposta = {
      igreja: { nome: igreja.nome, slug: igreja.slug },
      visual,
      total: publicacoes.length,
      publicacoes,
      eventos
    };

    // TTL curto: a vitrine pública fica visível por até 1 minuto após a publicação.
    // Cache-Control no navegador/CDN evita baixar o JSON repetidamente (economia de dados).
    await cacheSet(chave, resposta, 60);
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return res.json(resposta);
  } catch (err) {
    return next(err);
  }
});

export default router;
