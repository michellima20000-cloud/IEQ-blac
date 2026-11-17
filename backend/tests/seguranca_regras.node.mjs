import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validarPermissao } from '../src/permissions/rules.ts';
import { exigirSegredoManutencao } from '../src/middlewares/setupSecret.ts';
import { criarUsuarioSchema, atualizarUsuarioSchema } from '../src/modules/usuarios/usuarios.schemas.ts';
import { retencaoFotosSchema } from '../src/modules/midia/midia.schemas.ts';
import { definirStatusInicial } from '../src/modules/midia/midia.service.ts';
import { ENV } from '../src/config/env.ts';

const IGREJA_MATRIZ = 'igreja-matriz-id';
const CELULA_1 = 'celula-1-id';
const REDE_1 = 'rede-1-id';

describe('Etapa 7 - Seguranca das Rotas e Regras de Isolamento', () => {
  describe('1. Rotas de manutencao exigem o segredo (SETUP_SECRET)', () => {
    function respostaFalsa() {
      const estado = { status: 0, body: null };
      const res = {
        status: (codigo) => {
          estado.status = codigo;
          return {
            json: (corpo) => {
              estado.body = corpo;
            }
          };
        }
      };
      return { res, estado };
    }

    it('deve BLOQUEAR (503) quando o SETUP_SECRET nao esta configurado', () => {
      const segredoOriginal = ENV.SETUP_SECRET;
      ENV.SETUP_SECRET = '';
      try {
        const { res, estado } = respostaFalsa();
        let passou = false;
        exigirSegredoManutencao({ headers: {}, query: {} }, res, () => { passou = true; });
        assert.strictEqual(passou, false);
        assert.strictEqual(estado.status, 503);
      } finally {
        ENV.SETUP_SECRET = segredoOriginal;
      }
    });

    it('deve BLOQUEAR (401) quando o segredo informado esta errado', () => {
      const segredoOriginal = ENV.SETUP_SECRET;
      ENV.SETUP_SECRET = 'segredo-correto-123';
      try {
        const { res, estado } = respostaFalsa();
        let passou = false;
        exigirSegredoManutencao(
          { headers: { 'x-setup-secret': 'segredo-errado' }, query: {} },
          res,
          () => { passou = true; }
        );
        assert.strictEqual(passou, false);
        assert.strictEqual(estado.status, 401);
      } finally {
        ENV.SETUP_SECRET = segredoOriginal;
      }
    });

    it('deve LIBERAR quando o segredo informado e o correto', () => {
      const segredoOriginal = ENV.SETUP_SECRET;
      ENV.SETUP_SECRET = 'segredo-correto-123';
      try {
        const { res } = respostaFalsa();
        let passou = false;
        exigirSegredoManutencao(
          { headers: { 'x-setup-secret': 'segredo-correto-123' }, query: {} },
          res,
          () => { passou = true; }
        );
        assert.strictEqual(passou, true);
      } finally {
        ENV.SETUP_SECRET = segredoOriginal;
      }
    });
  });

  describe('2. RBAC sem vinculo: acesso NEGADO (falha fechada)', () => {
    const alvo = { igreja_id: IGREJA_MATRIZ, redeId: REDE_1, celulaId: CELULA_1 };

    it('deve NEGAR para o lider de rede SEM rede vinculada', () => {
      const usuario = { id: 'u1', igreja_id: IGREJA_MATRIZ, perfil: 'REDE', redeId: null };
      assert.throws(() => {
        validarPermissao(usuario, 'CELULA', 'LER', alvo);
      }, /rede sem rede vinculada/);
    });

    it('deve NEGAR para o lider de celula SEM celula vinculada', () => {
      const usuario = { id: 'u2', igreja_id: IGREJA_MATRIZ, perfil: 'CELULA', celulaId: null };
      assert.throws(() => {
        validarPermissao(usuario, 'RELATORIO', 'LER', alvo);
      }, /sem .+lula vinculada/);
    });

    it('deve LIBERAR quando o vinculo existe e e o mesmo', () => {
      const usuario = { id: 'u3', igreja_id: IGREJA_MATRIZ, perfil: 'CELULA', celulaId: CELULA_1 };
      assert.strictEqual(validarPermissao(usuario, 'RELATORIO', 'LER', alvo), true);
    });
  });

  describe('3. Perfil ADM: so o proprio ADM concede', () => {
    it('o schema do Pastor NAO aceita criar usuario ADM', () => {
      const resultado = criarUsuarioSchema.safeParse({
        nome: 'Novo Administrador',
        email: 'adm.novo@ieq.com',
        senha: 'senha123',
        perfil: 'ADM'
      });
      assert.strictEqual(resultado.success, false, 'Pastor nao pode criar ADM');
    });

    it('o schema do Pastor NAO aceita promover para ADM', () => {
      const resultado = atualizarUsuarioSchema.safeParse({ perfil: 'ADM' });
      assert.strictEqual(resultado.success, false, 'Pastor nao pode promover para ADM');
    });

    it('o schema do Pastor aceita os perfis normais', () => {
      const resultado = criarUsuarioSchema.safeParse({
        nome: 'Lider de Celula',
        email: 'lider@ieq.com',
        senha: 'senha123',
        perfil: 'CELULA'
      });
      assert.strictEqual(resultado.success, true);
    });
  });

  describe('4. Prazo de retencao de fotos', () => {
    it('deve ACEITAR prazos entre 1 e 365 dias', () => {
      assert.strictEqual(retencaoFotosSchema.safeParse({ prazoRetencaoFotosDias: 60 }).success, true);
      assert.strictEqual(retencaoFotosSchema.safeParse({ prazoRetencaoFotosDias: 365 }).success, true);
    });

    it('deve REJEITAR prazo abaixo de 1 dia ou acima de 365 dias', () => {
      assert.strictEqual(retencaoFotosSchema.safeParse({ prazoRetencaoFotosDias: 0 }).success, false);
      assert.strictEqual(retencaoFotosSchema.safeParse({ prazoRetencaoFotosDias: 400 }).success, false);
    });
  });

  describe('5. Aprovacao de midia: respeita a solicitacao de aprovacao', () => {
    it('quando NAO solicita aprovacao, publica diretamente na vitrine (MIDIA ou PASTOR)', () => {
      assert.strictEqual(definirStatusInicial('MIDIA', false), 'PUBLICADO');
      assert.strictEqual(definirStatusInicial('MIDIA', undefined), 'PUBLICADO');
      assert.strictEqual(definirStatusInicial('PASTOR', false), 'PUBLICADO');
      assert.strictEqual(definirStatusInicial('PASTOR', undefined), 'PUBLICADO');
    });

    it('quando solicita aprovacao, entra como PENDENTE para o pastor aprovar', () => {
      assert.strictEqual(definirStatusInicial('MIDIA', true), 'PENDENTE');
      assert.strictEqual(definirStatusInicial('PASTOR', true), 'PENDENTE');
    });
  });
});
