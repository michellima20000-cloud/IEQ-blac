import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validarPermissao, PermissaoError } from '../src/permissions/rules.ts';

describe('RBAC & Isolamento Multi-tenant - Regras da Igreja', () => {
  const IGREJA_MATRIZ = 'igreja-matriz-id';
  const IGREJA_OUTRA = 'igreja-outra-id';

  const REDE_JOVENS = 'rede-jovens-id';
  const REDE_FAMILIA = 'rede-familia-id';

  const CELULA_1 = 'celula-1-id';
  const CELULA_2 = 'celula-2-id';
  const CELULA_3 = 'celula-3-id';

  const usuarioPastor = {
    id: 'user-pastor',
    igreja_id: IGREJA_MATRIZ,
    perfil: 'PASTOR'
  };

  const usuarioLiderRede = {
    id: 'user-rede-jovens',
    igreja_id: IGREJA_MATRIZ,
    perfil: 'REDE',
    redeId: REDE_JOVENS
  };

  const usuarioLiderCelula = {
    id: 'user-celula-1',
    igreja_id: IGREJA_MATRIZ,
    perfil: 'CELULA',
    redeId: REDE_JOVENS,
    celulaId: CELULA_1
  };

  const usuarioMidia = {
    id: 'user-midia',
    igreja_id: IGREJA_MATRIZ,
    perfil: 'MIDIA'
  };

  const usuarioOutraIgreja = {
    id: 'user-outra-igreja',
    igreja_id: IGREJA_OUTRA,
    perfil: 'PASTOR'
  };

  const alvoCelula1 = {
    igreja_id: IGREJA_MATRIZ,
    redeId: REDE_JOVENS,
    celulaId: CELULA_1
  };

  const alvoCelula2 = {
    igreja_id: IGREJA_MATRIZ,
    redeId: REDE_JOVENS,
    celulaId: CELULA_2
  };

  const alvoCelula3 = {
    igreja_id: IGREJA_MATRIZ,
    redeId: REDE_FAMILIA,
    celulaId: CELULA_3
  };

  const alvoOutraIgreja = {
    igreja_id: IGREJA_OUTRA,
    redeId: 'rede-outra',
    celulaId: 'celula-outra'
  };

  it('1. Líder de célula só acessa a própria célula (e é bloqueado em outras da mesma rede e de outras redes)', () => {
    assert.strictEqual(validarPermissao(usuarioLiderCelula, 'CELULA', 'LER', alvoCelula1), true);
    assert.strictEqual(validarPermissao(usuarioLiderCelula, 'MEMBRO', 'CRIAR', alvoCelula1), true);
    assert.strictEqual(validarPermissao(usuarioLiderCelula, 'RELATORIO', 'CRIAR', alvoCelula1), true);

    assert.throws(() => {
      validarPermissao(usuarioLiderCelula, 'CELULA', 'LER', alvoCelula2);
    }, /Líder de célula só pode acessar a sua própria célula/);

    assert.throws(() => {
      validarPermissao(usuarioLiderCelula, 'RELATORIO', 'LER', alvoCelula3);
    }, /Líder de célula só pode acessar a sua própria célula/);
  });

  it('2. Líder de rede só acessa as células da sua rede (e é bloqueado em outras redes)', () => {
    assert.strictEqual(validarPermissao(usuarioLiderRede, 'CELULA', 'LER', alvoCelula1), true);
    assert.strictEqual(validarPermissao(usuarioLiderRede, 'CELULA', 'LER', alvoCelula2), true);
    assert.strictEqual(validarPermissao(usuarioLiderRede, 'RELATORIO', 'LER', alvoCelula1), true);

    assert.throws(() => {
      validarPermissao(usuarioLiderRede, 'CELULA', 'LER', alvoCelula3);
    }, /Líder de rede só pode acessar células da sua própria rede/);
  });

  it('3. Mídia NÃO acessa nada de células (células, membros, visitantes, relatórios)', () => {
    assert.throws(() => {
      validarPermissao(usuarioMidia, 'CELULA', 'LER', alvoCelula1);
    }, /Perfil Mídia não possui acesso ao módulo de células/);

    assert.throws(() => {
      validarPermissao(usuarioMidia, 'MEMBRO', 'LER', alvoCelula1);
    }, /Perfil Mídia não possui acesso ao módulo de células/);

    assert.throws(() => {
      validarPermissao(usuarioMidia, 'VISITANTE', 'LER', alvoCelula1);
    }, /Perfil Mídia não possui acesso ao módulo de células/);

    assert.throws(() => {
      validarPermissao(usuarioMidia, 'RELATORIO', 'LER', alvoCelula1);
    }, /Perfil Mídia não possui acesso ao módulo de células/);
  });

  it('4. Nenhum perfil acessa dados de outra igreja (Isolamento Multi-tenant)', () => {
    assert.throws(() => {
      validarPermissao(usuarioOutraIgreja, 'CELULA', 'LER', alvoCelula1);
    }, /Tentativa de acesso a dados de outra igreja/);

    assert.throws(() => {
      validarPermissao(usuarioPastor, 'CELULA', 'LER', alvoOutraIgreja);
    }, /Tentativa de acesso a dados de outra igreja/);

    assert.throws(() => {
      validarPermissao(usuarioLiderCelula, 'RELATORIO', 'LER', alvoOutraIgreja);
    }, /Tentativa de acesso a dados de outra igreja/);

    assert.throws(() => {
      validarPermissao(usuarioMidia, 'MIDIA', 'LER', alvoOutraIgreja);
    }, /Tentativa de acesso a dados de outra igreja/);
  });

  it('5. Pastor possui acesso total aos recursos da sua igreja', () => {
    assert.strictEqual(validarPermissao(usuarioPastor, 'CELULA', 'LER', alvoCelula1), true);
    assert.strictEqual(validarPermissao(usuarioPastor, 'CELULA', 'LER', alvoCelula3), true);
    assert.strictEqual(validarPermissao(usuarioPastor, 'RELATORIO', 'LER', alvoCelula1), true);
    assert.strictEqual(validarPermissao(usuarioPastor, 'MEMBRO', 'LER', alvoCelula2), true);
  });

  it('6. ADM (superusuário) acessa todas as igrejas (bypass de isolamento)', () => {
    const usuarioAdm = {
      id: 'user-adm',
      igreja_id: IGREJA_MATRIZ,
      perfil: 'ADM'
    };

    assert.strictEqual(validarPermissao(usuarioAdm, 'CELULA', 'LER', alvoCelula1), true);
    assert.strictEqual(validarPermissao(usuarioAdm, 'CELULA', 'LER', alvoCelula3), true);
    assert.strictEqual(validarPermissao(usuarioAdm, 'RELATORIO', 'EDITAR', alvoOutraIgreja), true);
    assert.strictEqual(validarPermissao(usuarioAdm, 'USUARIO', 'EXCLUIR', alvoOutraIgreja), true);
    assert.strictEqual(validarPermissao(usuarioAdm, 'MIDIA', 'CRIAR', alvoOutraIgreja), true);
  });
});
