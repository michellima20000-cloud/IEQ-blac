import { describe, it, expect } from 'vitest';
import { validarPermissao, PermissaoError } from '../src/permissions/rules.js';
import { UsuarioAutenticado, EntidadeAlvo } from '../src/permissions/types.js';

describe('RBAC & Isolamento Multi-tenant - Regras da Igreja', () => {
  const IGREJA_MATRIZ = 'igreja-matriz-id';
  const IGREJA_OUTRA = 'igreja-outra-id';

  const REDE_JOVENS = 'rede-jovens-id';
  const REDE_FAMILIA = 'rede-familia-id';

  const CELULA_1 = 'celula-1-id'; // Na REDE_JOVENS
  const CELULA_2 = 'celula-2-id'; // Na REDE_JOVENS
  const CELULA_3 = 'celula-3-id'; // Na REDE_FAMILIA

  // Usuários de teste
  const usuarioPastor: UsuarioAutenticado = {
    id: 'user-pastor',
    igreja_id: IGREJA_MATRIZ,
    perfil: 'PASTOR'
  };

  const usuarioLiderRede: UsuarioAutenticado = {
    id: 'user-rede-jovens',
    igreja_id: IGREJA_MATRIZ,
    perfil: 'REDE',
    redeId: REDE_JOVENS
  };

  const usuarioLiderCelula: UsuarioAutenticado = {
    id: 'user-celula-1',
    igreja_id: IGREJA_MATRIZ,
    perfil: 'CELULA',
    redeId: REDE_JOVENS,
    celulaId: CELULA_1
  };

  const usuarioMidia: UsuarioAutenticado = {
    id: 'user-midia',
    igreja_id: IGREJA_MATRIZ,
    perfil: 'MIDIA'
  };

  const usuarioOutraIgreja: UsuarioAutenticado = {
    id: 'user-outra-igreja',
    igreja_id: IGREJA_OUTRA,
    perfil: 'PASTOR'
  };

  // Alvos de teste
  const alvoCelula1: EntidadeAlvo = {
    igreja_id: IGREJA_MATRIZ,
    redeId: REDE_JOVENS,
    celulaId: CELULA_1
  };

  const alvoCelula2: EntidadeAlvo = {
    igreja_id: IGREJA_MATRIZ,
    redeId: REDE_JOVENS,
    celulaId: CELULA_2
  };

  const alvoCelula3: EntidadeAlvo = {
    igreja_id: IGREJA_MATRIZ,
    redeId: REDE_FAMILIA,
    celulaId: CELULA_3
  };

  const alvoOutraIgreja: EntidadeAlvo = {
    igreja_id: IGREJA_OUTRA,
    redeId: 'rede-outra',
    celulaId: 'celula-outra'
  };

  describe('1. Regra do Líder de Célula', () => {
    it('deve permitir acesso à própria célula', () => {
      expect(validarPermissao(usuarioLiderCelula, 'CELULA', 'LER', alvoCelula1)).toBe(true);
      expect(validarPermissao(usuarioLiderCelula, 'MEMBRO', 'CRIAR', alvoCelula1)).toBe(true);
      expect(validarPermissao(usuarioLiderCelula, 'RELATORIO', 'CRIAR', alvoCelula1)).toBe(true);
    });

    it('deve BLOQUEAR acesso a outra célula da mesma rede', () => {
      expect(() => {
        validarPermissao(usuarioLiderCelula, 'CELULA', 'LER', alvoCelula2);
      }).toThrowError('Líder de célula só pode acessar a sua própria célula');
    });

    it('deve BLOQUEAR acesso a célula de outra rede', () => {
      expect(() => {
        validarPermissao(usuarioLiderCelula, 'RELATORIO', 'LER', alvoCelula3);
      }).toThrowError('Líder de célula só pode acessar a sua própria célula');
    });
  });

  describe('2. Regra do Líder de Rede', () => {
    it('deve permitir acesso a todas as células da sua rede', () => {
      expect(validarPermissao(usuarioLiderRede, 'CELULA', 'LER', alvoCelula1)).toBe(true);
      expect(validarPermissao(usuarioLiderRede, 'CELULA', 'LER', alvoCelula2)).toBe(true);
      expect(validarPermissao(usuarioLiderRede, 'RELATORIO', 'LER', alvoCelula1)).toBe(true);
    });

    it('deve BLOQUEAR acesso a células de outra rede', () => {
      expect(() => {
        validarPermissao(usuarioLiderRede, 'CELULA', 'LER', alvoCelula3);
      }).toThrowError('Líder de rede só pode acessar células da sua própria rede');
    });
  });

  describe('3. Regra do Perfil Mídia', () => {
    it('NUNCA deve acessar dados de células', () => {
      expect(() => {
        validarPermissao(usuarioMidia, 'CELULA', 'LER', alvoCelula1);
      }).toThrowError('Perfil Mídia não possui acesso ao módulo de células');
    });

    it('NUNCA deve acessar membros ou visitantes', () => {
      expect(() => {
        validarPermissao(usuarioMidia, 'MEMBRO', 'LER', alvoCelula1);
      }).toThrowError('Perfil Mídia não possui acesso ao módulo de células');

      expect(() => {
        validarPermissao(usuarioMidia, 'VISITANTE', 'LER', alvoCelula1);
      }).toThrowError('Perfil Mídia não possui acesso ao módulo de células');
    });

    it('NUNCA deve acessar relatórios de células', () => {
      expect(() => {
        validarPermissao(usuarioMidia, 'RELATORIO', 'LER', alvoCelula1);
      }).toThrowError('Perfil Mídia não possui acesso ao módulo de células');
    });
  });

  describe('4. Regra de Isolamento Multi-tenant entre Igrejas', () => {
    it('pastor de outra igreja NUNCA deve acessar dados da Igreja Matriz', () => {
      expect(() => {
        validarPermissao(usuarioOutraIgreja, 'CELULA', 'LER', alvoCelula1);
      }).toThrowError('Tentativa de acesso a dados de outra igreja');
    });

    it('pastor da Igreja Matriz NUNCA deve acessar dados de outra igreja', () => {
      expect(() => {
        validarPermissao(usuarioPastor, 'CELULA', 'LER', alvoOutraIgreja);
      }).toThrowError('Tentativa de acesso a dados de outra igreja');
    });

    it('qualquer usuário é estritamente barrado ao tentar cruzar igreja_id', () => {
      expect(() => {
        validarPermissao(usuarioLiderCelula, 'RELATORIO', 'LER', alvoOutraIgreja);
      }).toThrowError('Tentativa de acesso a dados de outra igreja');

      expect(() => {
        validarPermissao(usuarioMidia, 'MIDIA', 'LER', alvoOutraIgreja);
      }).toThrowError('Tentativa de acesso a dados de outra igreja');
    });
  });

  describe('5. Regra do Pastor', () => {
    it('deve ter acesso irrestrito a todos os recursos da sua igreja', () => {
      expect(validarPermissao(usuarioPastor, 'CELULA', 'LER', alvoCelula1)).toBe(true);
      expect(validarPermissao(usuarioPastor, 'CELULA', 'LER', alvoCelula3)).toBe(true);
      expect(validarPermissao(usuarioPastor, 'RELATORIO', 'LER', alvoCelula1)).toBe(true);
      expect(validarPermissao(usuarioPastor, 'MEMBRO', 'LER', alvoCelula2)).toBe(true);
    });
  });
});
