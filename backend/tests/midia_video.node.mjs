import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { detectarMimeType, mimeDeVideoValido } from '../src/services/imageProcessor.ts';
import { criarMidiaSchema } from '../src/modules/midia/midia.schemas.ts';
import { dividirEmPartes, TAMANHO_PARTE_ARQUIVO } from '../src/utils/upload.ts';
import arquivoPublicoRoutes from '../src/modules/midia/arquivo.publico.routes.ts';

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

  describe('3. Arquivo gravado em pedaços (memoria baixa na API)', () => {
    it('deve dividir o video em pedaços de 4 MB', () => {
      assert.strictEqual(TAMANHO_PARTE_ARQUIVO, 4 * 1024 * 1024);
      const video = Buffer.alloc(TAMANHO_PARTE_ARQUIVO * 2 + 1024, 7);
      const partes = dividirEmPartes(video);

      assert.strictEqual(partes.length, 3);
      assert.strictEqual(partes[0].length, TAMANHO_PARTE_ARQUIVO);
      assert.strictEqual(partes[1].length, TAMANHO_PARTE_ARQUIVO);
      assert.strictEqual(partes[2].length, 1024);
      assert.strictEqual(partes.reduce((s, p) => s + p.length, 0), video.length);
    });

    it('nao pode gerar pedaco maior que o limite (bytea gigante estourava a API)', () => {
      const video = Buffer.alloc(TAMANHO_PARTE_ARQUIVO * 3, 3);
      for (const parte of dividirEmPartes(video)) {
        assert.ok(parte.length <= TAMANHO_PARTE_ARQUIVO);
      }
    });

    it('deve devolver lista vazia para arquivo sem conteudo', () => {
      assert.deepStrictEqual(dividirEmPartes(Buffer.alloc(0)), []);
    });
  });

  describe('4. Rota publica do arquivo (vitrine compartilhavel sem login)', () => {
    it('deve expor somente a rota do arquivo, sem autenticacao obrigatoria', () => {
      const rotas = arquivoPublicoRoutes.stack.filter((l) => l.route);
      assert.strictEqual(rotas.length, 1);
      assert.strictEqual(rotas[0].route.path, '/midia/:id/arquivo');
      assert.strictEqual(rotas[0].route.stack.length, 1, 'Nenhum middleware de autenticacao na rota publica');
    });

    it('deve montar a rota publica ANTES do router de celulas (que exige token)', async () => {
      // Lê o arquivo de rotas: o router de células aplica authMiddleware em
      // TODOS os caminhos, então a rota pública precisa ser montada antes dele.
      const fonte = await readFile(new URL('../src/routes.ts', import.meta.url), 'utf8');
      const indiceArquivo = fonte.indexOf("v1Router.use('/', arquivoPublicoRoutes)");
      const indiceCelulas = fonte.indexOf("v1Router.use('/', celulasRoutes)");

      assert.ok(indiceArquivo >= 0, 'O router publico do arquivo precisa ser montado');
      assert.ok(indiceCelulas >= 0, 'O router de celulas precisa ser montado');
      assert.ok(
        indiceArquivo < indiceCelulas,
        'A rota do arquivo deve vir antes do router de celulas (que exige autenticacao em todos os caminhos)'
      );
    });

    it('NUNCA pode expor dados de celulas, membros, visitantes ou relatórios', () => {
      const caminhos = arquivoPublicoRoutes.stack.filter((l) => l.route).map((l) => l.route.path);
      const proibidos = ['celula', 'membro', 'visitante', 'relatorio'];
      for (const caminho of caminhos) {
        for (const termo of proibidos) {
          assert.ok(
            !caminho.toLowerCase().includes(termo),
            `Rota pública não pode expor dados sensíveis: ${caminho}`
          );
        }
      }
    });
  });
});
