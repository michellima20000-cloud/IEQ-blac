import { describe, it } from 'node:test';
import assert from 'node:assert';
import { detectarMimeType, mimeDeVideoValido } from '../src/services/imageProcessor.ts';
import { criarMidiaSchema } from '../src/modules/midia/midia.schemas.ts';
import { authMiddleware } from '../src/middlewares/auth.ts';
import midiaRoutes from '../src/modules/midia/midia.routes.ts';

function mp4(marca = 'isom') {
  const buf = Buffer.alloc(32);
  buf.writeUInt32BE(0x20, 0);
  buf.write('ftyp', 4, 'latin1');
  buf.write(marca, 8, 'latin1');
  return buf;
}

describe('Etapa 8 - Video para a vitrine (upload sem base64)', () => {
  describe('1. MIME real dos videos', () => {
    it('deve identificar MP4, MOV e WebM pelos bytes do arquivo', () => {
      assert.strictEqual(detectarMimeType(mp4('isom')), 'video/mp4');
      assert.strictEqual(detectarMimeType(mp4('mp42')), 'video/mp4');
      assert.strictEqual(detectarMimeType(mp4('qt  ')), 'video/quicktime');

      const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x02, 0x03, 0x04]);
      assert.strictEqual(detectarMimeType(webm), 'video/webm');
    });

    it('deve considerar validos apenas os videos aceitos pelo navegador', () => {
      assert.ok(mimeDeVideoValido('video/mp4'));
      assert.ok(mimeDeVideoValido('video/quicktime'));
      assert.ok(mimeDeVideoValido('video/webm'));
      assert.ok(!mimeDeVideoValido('application/octet-stream'));
      assert.ok(!mimeDeVideoValido('image/png'));
    });
  });

  describe('2. Regra do conteudo de video', () => {
    it('deve aceitar video com arquivo enviado (sem link do YouTube)', async () => {
      const dados = await criarMidiaSchema.parseAsync({
        tipo: 'VIDEO',
        titulo: 'Video do culto',
        precisaAprovacao: false,
        temArquivo: true,
        tamanhoArquivoBytes: 1024
      });
      assert.strictEqual(dados.tipo, 'VIDEO');
      assert.strictEqual(dados.temArquivo, true);
    });

    it('deve recusar video sem arquivo e sem link', async () => {
      await assert.rejects(() => criarMidiaSchema.parseAsync({
        tipo: 'VIDEO',
        titulo: 'Video do culto',
        precisaAprovacao: false
      }));
    });

    it('deve aceitar video somente com link do YouTube valido', async () => {
      const dados = await criarMidiaSchema.parseAsync({
        tipo: 'VIDEO',
        titulo: 'Video do culto',
        videoUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
        precisaAprovacao: false
      });
      assert.strictEqual(dados.videoUrl, 'https://www.youtube.com/watch?v=abcdefghijk');
    });
  });

  describe('3. Rota publica do arquivo (vitrine compartilhavel sem login)', () => {
    it('deve servir /midia/:id/arquivo ANTES do authMiddleware', () => {
      const camadas = midiaRoutes.stack;
      const indiceArquivo = camadas.findIndex((l) => l.route && l.route.path === '/midia/:id/arquivo');
      const indiceAuth = camadas.findIndex((l) => !l.route && l.handle === authMiddleware);

      assert.ok(indiceArquivo >= 0, 'A rota do arquivo precisa existir');
      assert.ok(indiceAuth >= 0, 'O midia.routes precisa manter o authMiddleware');
      assert.ok(
        indiceArquivo < indiceAuth,
        'A rota do arquivo deve ser registrada antes do authMiddleware (vitrine publica sem login)'
      );
    });
  });
});
