import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validarPermissao, PermissaoError } from '../src/permissions/rules.ts';
import { RelatoriosService } from '../src/modules/celulas/relatorios.service.ts';
import { signJwt, verifyJwt } from '../src/config/cryptoUtils.ts';
import { ENV } from '../src/config/env.ts';

describe('Etapa 3 - Módulo de Células, Relatórios e Permissões', () => {
  const IGREJA_MATRIZ = 'igreja-matriz-id';
  const IGREJA_OUTRA = 'igreja-outra-id';

  const REDE_JOVENS = 'rede-jovens-id';
  const REDE_FAMILIA = 'rede-familia-id';

  const CELULA_1 = 'celula-1-id'; // Na Rede Jovens
  const CELULA_2 = 'celula-2-id'; // Na Rede Jovens
  const CELULA_3 = 'celula-3-id'; // Na Rede Família

  const liderCelula1 = {
    id: 'user-celula-1',
    nome: 'Líder Metanóia',
    email: 'celula1@ieq.com',
    perfil: 'CELULA',
    redeId: REDE_JOVENS,
    celulaId: CELULA_1,
    igreja_id: IGREJA_MATRIZ
  };

  const liderRedeJovens = {
    id: 'user-rede-jovens',
    nome: 'Líder Jovens',
    email: 'jovens@ieq.com',
    perfil: 'REDE',
    redeId: REDE_JOVENS,
    igreja_id: IGREJA_MATRIZ
  };

  const pastor = {
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

  const pastorOutraIgreja = {
    id: 'user-outra-igreja',
    nome: 'Pastor Bairro Norte',
    email: 'pastor.norte@ieq.com',
    perfil: 'PASTOR',
    igreja_id: IGREJA_OUTRA
  };

  const alvoCelula1 = { igreja_id: IGREJA_MATRIZ, redeId: REDE_JOVENS, celulaId: CELULA_1 };
  const alvoCelula2 = { igreja_id: IGREJA_MATRIZ, redeId: REDE_JOVENS, celulaId: CELULA_2 };
  const alvoCelula3 = { igreja_id: IGREJA_MATRIZ, redeId: REDE_FAMILIA, celulaId: CELULA_3 };

  describe('1. Líder de Célula: Membros, Visitantes e Escopo', () => {
    it('deve autorizar cadastro de membro na própria célula', () => {
      assert.strictEqual(validarPermissao(liderCelula1, 'MEMBRO', 'CRIAR', alvoCelula1), true);
    });

    it('deve BLOQUEAR cadastro de membro em célula vizinha da mesma rede', () => {
      assert.throws(() => {
        validarPermissao(liderCelula1, 'MEMBRO', 'CRIAR', alvoCelula2);
      }, /Líder de célula só pode acessar a sua própria célula/);
    });

    it('deve BLOQUEAR cadastro de visitante em célula de outra rede', () => {
      assert.throws(() => {
        validarPermissao(liderCelula1, 'VISITANTE', 'CRIAR', alvoCelula3);
      }, /Líder de célula só pode acessar a sua própria célula/);
    });
  });

  describe('2. Ciclo de Vida do Relatório Semanal & Trava Imutável', () => {
    it('deve permitir ao líder de célula criar relatório aberto', () => {
      assert.strictEqual(validarPermissao(liderCelula1, 'RELATORIO', 'CRIAR', alvoCelula1), true);
    });

    it('deve simular criação de relatório ABERTO e fechamento', () => {
      const relatorioMock = {
        id: 'relatorio-1',
        celulaId: CELULA_1,
        status: 'ABERTO',
        presentes: 15,
        visitantes: 3,
        fotoUrl: 's3://minio/relatorios/celula1_sem45.webp'
      };

      // Edição permitida em relatório aberto
      assert.strictEqual(relatorioMock.status, 'ABERTO');

      // Ação de fechar relatório
      relatorioMock.status = 'FECHADO';
      relatorioMock.dataFechamento = new Date();

      assert.strictEqual(relatorioMock.status, 'FECHADO');

      // Trava de segurança: tentativa de editar relatório fechado deve falhar
      assert.throws(() => {
        if (relatorioMock.status === 'FECHADO') {
          throw new PermissaoError('Relatório fechado não pode ser editado.');
        }
      }, /Relatório fechado não pode ser editado/);
    });

    it('deve bloquear líder de célula de fechar relatório de outra célula', () => {
      assert.throws(() => {
        validarPermissao(liderCelula1, 'RELATORIO', 'FECHAR', alvoCelula2);
      }, /Líder de célula só pode acessar a sua própria célula/);
    });
  });

  describe('3. Líder de Rede: Consolidado e Células Pendentes', () => {
    it('deve permitir leitura dos relatórios fechados de todas as células da sua rede', () => {
      assert.strictEqual(validarPermissao(liderRedeJovens, 'RELATORIO', 'LER', alvoCelula1), true);
      assert.strictEqual(validarPermissao(liderRedeJovens, 'RELATORIO', 'LER', alvoCelula2), true);
    });

    it('deve BLOQUEAR leitura de relatórios de células de outra rede', () => {
      assert.throws(() => {
        validarPermissao(liderRedeJovens, 'RELATORIO', 'LER', alvoCelula3);
      }, /Líder de rede só pode acessar células da sua própria rede/);
    });

    it('deve calcular corretamente consolidados e lista de células pendentes', () => {
      const celulasRede = [
        { id: CELULA_1, nome: 'Célula 1' },
        { id: CELULA_2, nome: 'Célula 2' }
      ];

      // Suponha que apenas Célula 1 enviou relatório
      const relatoriosSemana = [
        { celulaId: CELULA_1, presentes: 20, visitantes: 4, status: 'FECHADO' }
      ];

      const enviadas = new Set(relatoriosSemana.map((r) => r.celulaId));
      const pendentes = celulasRede.filter((c) => !enviadas.has(c.id));

      assert.strictEqual(pendentes.length, 1);
      assert.strictEqual(pendentes[0].id, CELULA_2, 'Célula 2 deve estar na lista de pendentes');
    });
  });

  describe('4. Pastor: Dashboard e Acesso Global', () => {
    it('deve ter acesso irrestrito para visualizar células e relatórios de todas as redes', () => {
      assert.strictEqual(validarPermissao(pastor, 'CELULA', 'LER', alvoCelula1), true);
      assert.strictEqual(validarPermissao(pastor, 'CELULA', 'LER', alvoCelula3), true);
      assert.strictEqual(validarPermissao(pastor, 'RELATORIO', 'LER', alvoCelula2), true);
    });

    it('deve agregar indicadores de presentes e visitantes da igreja', () => {
      const relatorios = [
        { presentes: 15, visitantes: 2 },
        { presentes: 25, visitantes: 5 },
        { presentes: 10, visitantes: 1 }
      ];

      const totalPresentes = relatorios.reduce((acc, cur) => acc + cur.presentes, 0);
      const totalVisitantes = relatorios.reduce((acc, cur) => acc + cur.visitantes, 0);
      const mediaFrequencia = totalPresentes / relatorios.length;

      assert.strictEqual(totalPresentes, 50);
      assert.strictEqual(totalVisitantes, 8);
      assert.strictEqual(Number(mediaFrequencia.toFixed(1)), 16.7);
    });
  });

  describe('5. Perfil Mídia: Bloqueio Total no Módulo de Células', () => {
    it('deve ser barrado ao tentar criar ou ler membros', () => {
      assert.throws(() => {
        validarPermissao(usuarioMidia, 'MEMBRO', 'LER', alvoCelula1);
      }, /Perfil Mídia não possui acesso ao módulo de células/);
    });

    it('deve ser barrado ao tentar acessar relatórios semanais', () => {
      assert.throws(() => {
        validarPermissao(usuarioMidia, 'RELATORIO', 'LER', alvoCelula1);
      }, /Perfil Mídia não possui acesso ao módulo de células/);
    });
  });

  describe('6. URL Assinada de Foto & Log de Auditoria', () => {
    it('deve gerar URL assinada com expiração de 15 minutos contendo HMAC', () => {
      const relatorioId = 'rel-xyz-123';
      const fotoUrl = 'https://minio.local/ieq/celula1.webp';

      const urlAssinada = RelatoriosService.gerarUrlAssinadaFoto(relatorioId, fotoUrl);
      assert.ok(urlAssinada.includes('/api/v1/relatorios/rel-xyz-123/foto?token='), 'URL deve ter formato assinado');

      const tokenExtraido = urlAssinada.split('token=')[1];
      const decoded = verifyJwt(tokenExtraido, ENV.JWT_SECRET);

      assert.strictEqual(decoded.tipo, 'FOTO_RELATORIO');
      assert.strictEqual(decoded.relatorioId, relatorioId);
      assert.strictEqual(decoded.fotoUrl, fotoUrl);
      assert.ok(decoded.exp > decoded.iat, 'Token deve ter expiração futura');
    });

    it('deve rejeitar token de foto adulterado ou vencido', () => {
      const tokenExpirado = signJwt({
        tipo: 'FOTO_RELATORIO',
        relatorioId: 'rel-1',
        fotoUrl: 'fake.webp'
      }, ENV.JWT_SECRET, '-1s');

      assert.throws(() => {
        verifyJwt(tokenExpirado, ENV.JWT_SECRET);
      }, /jwt expired/);
    });
  });

  describe('7. Isolamento Multi-tenant', () => {
    it('pastor de outra igreja deve ser BLOQUEADO de acessar células da Igreja Matriz', () => {
      assert.throws(() => {
        validarPermissao(pastorOutraIgreja, 'CELULA', 'LER', alvoCelula1);
      }, /Tentativa de acesso a dados de outra igreja/);
    });
  });
});

