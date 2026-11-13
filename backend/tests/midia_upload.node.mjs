import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import { unlink } from 'node:fs/promises';
import { normalizarArquivos } from '../src/utils/upload.ts';
import { detectarMimeType } from '../src/services/imageProcessor.ts';
import { uploadMidia, camposArquivo } from '../src/modules/midia/midia.routes.ts';

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

describe('Etapa 7 - Upload de midia para a vitrine (campo do arquivo)', () => {
  let server;
  let base = '';

  before(async () => {
    const app = express();
    app.post('/upload', uploadMidia.fields(camposArquivo), (req, res) => {
      const arquivos = normalizarArquivos(req.files);
      // O multer grava em disco: o arquivo temporário é apagado depois
      Promise.all(arquivos.map((a) => (a?.path ? unlink(a.path).catch(() => {}) : null)));
      res.json({
        quantidade: arquivos.length,
        nome: arquivos[0]?.originalname || null,
        emDisco: !!arquivos[0]?.path
      });
    });
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const addr = server.address();
    base = `http://127.0.0.1:${addr.port}`;
  });

  after(() => {
    server?.close?.();
  });

  describe('1. Normalizacao dos arquivos recebidos', () => {
    it('deve aceitar o formato de array (campo unico)', () => {
      const arquivos = normalizarArquivos([{ originalname: 'a.png' }]);
      assert.strictEqual(arquivos.length, 1);
      assert.strictEqual(arquivos[0].originalname, 'a.png');
    });

    it('deve aceitar o formato de objeto (varios campos aceitos)', () => {
      const arquivos = normalizarArquivos({
        arquivo: [{ originalname: 'a.png' }],
        arquivos: [{ originalname: 'b.png' }]
      });
      assert.strictEqual(arquivos.length, 2);
    });

    it('deve devolver lista vazia quando nenhum arquivo foi enviado', () => {
      assert.deepStrictEqual(normalizarArquivos(undefined), []);
      assert.deepStrictEqual(normalizarArquivos(null), []);
      assert.deepStrictEqual(normalizarArquivos({}), []);
    });
  });

  describe('2. O upload aceita o campo enviado pelo app ("arquivo")', () => {
    it('NAO pode falhar com "Unexpected file field" no campo "arquivo"', async () => {
      const fd = new FormData();
      fd.append('arquivo', new Blob([PNG_1PX], { type: 'image/png' }), 'teste.png');
      fd.append('tipo', 'FOTO');
      fd.append('titulo', 'Upload de teste');

      const res = await fetch(`${base}/upload`, { method: 'POST', body: fd });
      const corpo = await res.text();
      assert.strictEqual(res.status, 200, `Upload falhou: ${res.status} ${corpo}`);

      const json = JSON.parse(corpo);
      assert.strictEqual(json.quantidade, 1);
      assert.strictEqual(json.nome, 'teste.png');
      assert.ok(json.emDisco, 'O upload deve gravar o arquivo em disco (memória baixa na API)');
    });

    it('continua aceitando o campo plural "arquivos" (API e integracoes)', async () => {
      const fd = new FormData();
      fd.append('arquivos', new Blob([PNG_1PX], { type: 'image/png' }), 'plural.png');

      const res = await fetch(`${base}/upload`, { method: 'POST', body: fd });
      const corpo = await res.text();
      assert.strictEqual(res.status, 200, `Upload falhou: ${res.status} ${corpo}`);

      const json = JSON.parse(corpo);
      assert.strictEqual(json.quantidade, 1);
      assert.strictEqual(json.nome, 'plural.png');
    });

    it('deve declarar os campos aceitos no upload', () => {
      const nomes = camposArquivo.map((c) => c.name);
      assert.ok(nomes.includes('arquivo'), 'O campo "arquivo" (usado pelo app) deve ser aceito');
      assert.ok(nomes.includes('arquivos'), 'O campo "arquivos" (API) deve ser aceito');
    });
  });

  describe('3. MIME real do arquivo (fallback sem sharp)', () => {
    it('deve identificar PNG, JPEG e WebP pelos bytes do arquivo', () => {
      assert.strictEqual(detectarMimeType(PNG_1PX), 'image/png');
      assert.strictEqual(detectarMimeType(Buffer.from([0xff, 0xd8, 0xff, 0x00])), 'image/jpeg');
      assert.strictEqual(
        detectarMimeType(Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP')])),
        'image/webp'
      );
    });

    it('NAO pode rotular um JPEG como image/webp (quebraria a exibicao)', () => {
      const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      assert.notStrictEqual(detectarMimeType(jpeg), 'image/webp');
    });
  });
});
