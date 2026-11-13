import { createHash } from 'node:crypto';
import { Router } from 'express';
import { prisma } from '../../config/prisma.ts';
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

/**
 * Logo da igreja (identidade visual).
 * Também fica gravada no banco como bytes e é servida por aqui,
 * em vez de viajar como base64 dentro de cada resposta da API.
 */
router.get('/logo/:igrejaId', async (req, res) => {
  try {
    const arquivo = await prisma.arquivoIgreja.findUnique({
      where: { igreja_id: String(req.params.igrejaId || '') },
      select: { mimeType: true, bytes: true }
    });

    if (!arquivo) {
      res.status(404).json({ error: 'NaoEncontrado', message: 'Logo não encontrado.' });
      return;
    }

    const bytes = Buffer.isBuffer(arquivo.bytes) ? arquivo.bytes : Buffer.from(arquivo.bytes as any);
    res.setHeader('Content-Type', arquivo.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', String(bytes.length));
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.end(bytes);
  } catch (err: any) {
    res.status(err.statusCode || 400).json({ error: err.name || 'Erro', message: err.message });
  }
});

export default router;
