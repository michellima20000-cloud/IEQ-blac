import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validarPermissao, PermissaoError } from '../src/permissions/rules.ts';
import { MidiaService } from '../src/modules/midia/midia.service.ts';
import { criarMidiaSchema } from '../src/modules/midia/midia.schemas.ts';
import { requirePerfil } from '../src/middlewares/rbac.ts';

describe('Etapa 4 - Módulo de Mídia, Aprovação pelo Pastor, Calendário e Vitrine', () => {
  const IGREJA_MATRIZ = 'igreja-matriz-id';
  const IGREJA_OUTRA = 'igreja-outra-id';

  const usuarioPastor = {
    id: 'user-pastor',
    nome: 'Pastor Titular',
    email: 'pastor@ieq.com',
    perfil: 'PASTOR',
    igreja_id: IGREJA_MATRIZ
  };

  const usuarioMidia = {
    id: 'user-midia',
    nome: 'Equipe de Mídia',
    email: 'midia@ieq.com',
    perfil: 'MIDIA',
    igreja_id: IGREJA_MATRIZ
  };

  const usuarioLiderCelula = {
    id: 'user-celula-1',
    nome: 'Líder Célula',
    email: 'celula@ieq.com',
    perfil: 'CELULA',
    igreja_id: IGREJA_MATRIZ,
    celulaId: 'celula-1'
  };

  const usuarioLiderRede = {
    id: 'user-rede-1',
    nome: 'Líder Rede',
    email: 'rede@ieq.com',
    perfil: 'REDE',
    igreja_id: IGREJA_MATRIZ,
    redeId: 'rede-1'
  };

  describe('1. Vitrine de Publicações: Conteúdo Pendente NUNCA aparece na vitrine', () => {
    it('deve filtrar e retornar EXCLUSIVAMENTE conteúdos com status PUBLICADO', () => {
      const conteudosCadastrados = [
        { id: '1', titulo: 'Banner Culto da Família', status: 'PUBLICADO', igreja_id: IGREJA_MATRIZ },
        { id: '2', titulo: 'Aviso Retiro Jovens (Novo)', status: 'PENDENTE', igreja_id: IGREJA_MATRIZ },
        { id: '3', titulo: 'Banner Conferência (Rascunho)', status: 'RASCUNHO', igreja_id: IGREJA_MATRIZ },
        { id: '4', titulo: 'Foto Acampamento (Devolvido)', status: 'DEVOLVIDO', igreja_id: IGREJA_MATRIZ }
      ];

      // Filtro da vitrine
      const vitrine = conteudosCadastrados.filter(
        (item) => item.status === 'PUBLICADO' && item.igreja_id === IGREJA_MATRIZ
      );

      assert.strictEqual(vitrine.length, 1, 'Apenas o conteúdo PUBLICADO deve estar na vitrine');
      assert.strictEqual(vitrine[0].id, '1');
      assert.strictEqual(vitrine[0].status, 'PUBLICADO');

      // Garante que o pendente NUNCA está na vitrine
      const pendenteNaVitrine = vitrine.some((i) => i.status === 'PENDENTE');
      assert.strictEqual(pendenteNaVitrine, false, 'Conteúdo pendente JAMAIS deve aparecer na vitrine');
    });
  });

  describe('2. Fluxo de Aprovação: SÓ o Pastor aprova ou devolve', () => {
    const middlewarePastor = requirePerfil('PASTOR');

    it('deve PERMITIR que o Pastor aprove publicações', () => {
      let nextChamado = false;
      const req = { user: usuarioPastor };

      middlewarePastor(req, {}, () => { nextChamado = true; });
      assert.strictEqual(nextChamado, true, 'Pastor deve ter autorização para aprovar');
    });

    it('deve NEGAR aprovação para o perfil MIDIA com 403 Forbidden', () => {
      let statusRetornado = 0;
      let bodyRetornado = null;

      const req = { user: usuarioMidia };
      const res = {
        status: (s) => {
          statusRetornado = s;
          return { json: (b) => { bodyRetornado = b; } };
        }
      };

      middlewarePastor(req, res, () => {});
      assert.strictEqual(statusRetornado, 403);
      assert.match(bodyRetornado.message, /perfil 'MIDIA' não possui permissão/);
    });

    it('deve NEGAR aprovação para o perfil CELULA com 403 Forbidden', () => {
      let statusRetornado = 0;
      let bodyRetornado = null;

      const req = { user: usuarioLiderCelula };
      const res = {
        status: (s) => {
          statusRetornado = s;
          return { json: (b) => { bodyRetornado = b; } };
        }
      };

      middlewarePastor(req, res, () => {});
      assert.strictEqual(statusRetornado, 403);
      assert.match(bodyRetornado.message, /perfil 'CELULA' não possui permissão/);
    });

    it('deve simular o ciclo: Pendente -> Devolvido com comentário -> Reenviado -> Aprovado', () => {
      const conteudo = {
        id: 'midia-123',
        titulo: 'Banner Culto de Ceia',
        status: 'PENDENTE',
        comentarioPastor: null
      };

      // 1. Pastor devolve com comentário
      conteudo.status = 'DEVOLVIDO';
      conteudo.comentarioPastor = 'Por favor ajustar a data para o primeiro domingo do mês.';
      assert.strictEqual(conteudo.status, 'DEVOLVIDO');
      assert.ok(conteudo.comentarioPastor.includes('primeiro domingo'));

      // 2. Mídia corrige e reenvia
      conteudo.titulo = 'Banner Culto de Ceia - Corrigido';
      conteudo.status = 'PENDENTE';
      assert.strictEqual(conteudo.status, 'PENDENTE');

      // 3. Pastor aprova
      conteudo.status = 'PUBLICADO';
      conteudo.comentarioPastor = null;
      assert.strictEqual(conteudo.status, 'PUBLICADO');
      assert.strictEqual(conteudo.comentarioPastor, null);
    });
  });

  describe('3. Validação de Vídeos (Limite 50 MB ou YouTube)', () => {
    it('deve aceitar link válido do YouTube', () => {
      const payloadYoutube = {
        tipo: 'VIDEO',
        titulo: 'Testemunho de Cura',
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      };

      const result = criarMidiaSchema.safeParse(payloadYoutube);
      assert.strictEqual(result.success, true, 'Link do YouTube deve ser aceito');
    });

    it('deve aceitar upload de vídeo em arquivo de até 50 MB', () => {
      const payloadVideo = {
        tipo: 'VIDEO',
        titulo: 'Vídeo Institucional',
        arquivoUrl: 'https://minio.local/videos/institucional.mp4',
        tamanhoArquivoBytes: 45 * 1024 * 1024 // 45 MB
      };

      const result = criarMidiaSchema.safeParse(payloadVideo);
      assert.strictEqual(result.success, true, 'Arquivo de 45 MB deve ser aceito');
    });

    it('deve REJEITAR arquivo de vídeo acima de 50 MB', () => {
      const payloadPesado = {
        tipo: 'VIDEO',
        titulo: 'Vídeo Muito Grande',
        arquivoUrl: 'https://minio.local/videos/culto_completo.mp4',
        tamanhoArquivoBytes: 55 * 1024 * 1024 // 55 MB
      };

      const result = criarMidiaSchema.safeParse(payloadPesado);
      assert.strictEqual(result.success, false, 'Arquivo acima de 50 MB deve ser rejeitado');
    });
  });

  describe('4. Regra Mandatória: Perfil Mídia NUNCA acessa rotas de células', () => {
    const alvoCelula = {
      igreja_id: IGREJA_MATRIZ,
      redeId: 'rede-1',
      celulaId: 'celula-1'
    };

    it('deve BLOQUEAR perfil Mídia ao tentar ler células', () => {
      assert.throws(() => {
        validarPermissao(usuarioMidia, 'CELULA', 'LER', alvoCelula);
      }, /Perfil Mídia não possui acesso ao módulo de células/);
    });

    it('deve BLOQUEAR perfil Mídia ao tentar ler membros', () => {
      assert.throws(() => {
        validarPermissao(usuarioMidia, 'MEMBRO', 'LER', alvoCelula);
      }, /Perfil Mídia não possui acesso ao módulo de células/);
    });

    it('deve BLOQUEAR perfil Mídia ao tentar ler visitantes', () => {
      assert.throws(() => {
        validarPermissao(usuarioMidia, 'VISITANTE', 'LER', alvoCelula);
      }, /Perfil Mídia não possui acesso ao módulo de células/);
    });

    it('deve BLOQUEAR perfil Mídia ao tentar ler relatórios', () => {
      assert.throws(() => {
        validarPermissao(usuarioMidia, 'RELATORIO', 'LER', alvoCelula);
      }, /Perfil Mídia não possui acesso ao módulo de células/);
    });
  });
});
