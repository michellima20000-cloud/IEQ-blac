import { describe, it } from 'node:test';
import assert from 'node:assert';
import { AuthService } from '../src/modules/auth/auth.service.ts';
import { ENV } from '../src/config/env.ts';
import { signJwt, verifyJwt } from '../src/config/cryptoUtils.ts';
import { authMiddleware } from '../src/middlewares/auth.ts';
import { requirePerfil } from '../src/middlewares/rbac.ts';
import { tenantMiddleware } from '../src/middlewares/tenant.ts';

describe('Etapa 2 - Autenticação JWT, Tokens & RBAC', () => {
  const IGREJA_MATRIZ = 'igreja-matriz-uuid';
  const IGREJA_OUTRA = 'igreja-outra-uuid';

  const mockPastor = {
    id: 'user-pastor-1',
    nome: 'Pastor Titular',
    email: 'pastor@ieq.com',
    perfil: 'PASTOR',
    igreja_id: IGREJA_MATRIZ
  };

  const mockLiderCelula = {
    id: 'user-celula-1',
    nome: 'Líder Célula',
    email: 'celula@ieq.com',
    perfil: 'CELULA',
    igreja_id: IGREJA_MATRIZ,
    celulaId: 'celula-uuid-1'
  };

  const mockMidia = {
    id: 'user-midia-1',
    nome: 'Equipe de Mídia',
    email: 'midia@ieq.com',
    perfil: 'MIDIA',
    igreja_id: IGREJA_MATRIZ
  };

  describe('1. Emissão de Tokens e Hash de Senha', () => {
    it('deve gerar access token e refresh token válidos no login', () => {
      const tokens = AuthService.gerarTokens(mockPastor);

      assert.ok(tokens.accessToken, 'Access token deve existir');
      assert.ok(tokens.refreshToken, 'Refresh token deve existir');

      // Decodificar o access token
      const decoded = verifyJwt(tokens.accessToken, ENV.JWT_SECRET);
      assert.strictEqual(decoded.sub, mockPastor.id);
      assert.strictEqual(decoded.igreja_id, mockPastor.igreja_id);
      assert.strictEqual(decoded.perfil, 'PASTOR');
    });

    it('deve validar e comparar hashes de senha corretamente', async () => {
      const senhaPlana = 'senhaSegura123';
      const hash = await AuthService.hashSenha(senhaPlana);

      assert.ok(hash.startsWith('$scrypt$'), 'Deve ser um hash seguro gerado');

      const match = await AuthService.verificarSenha(senhaPlana, hash);
      assert.strictEqual(match, true, 'Senha correta deve ser aceita');

      const wrongMatch = await AuthService.verificarSenha('senhaErrada', hash);
      assert.strictEqual(wrongMatch, false, 'Senha incorreta deve ser rejeitada');
    });
  });

  describe('2. Renovação (Refresh) e Revogação (Logout)', () => {
    it('deve verificar refresh token válido', () => {
      const tokens = AuthService.gerarTokens(mockPastor);
      const payload = AuthService.verificarRefreshToken(tokens.refreshToken);

      assert.strictEqual(payload.sub, mockPastor.id);
      assert.strictEqual(payload.igreja_id, mockPastor.igreja_id);
    });

    it('deve impedir uso de refresh token revogado após logout', () => {
      const tokens = AuthService.gerarTokens(mockPastor);

      // Realizar logout
      AuthService.revogarRefreshToken(tokens.refreshToken);

      assert.throws(() => {
        AuthService.verificarRefreshToken(tokens.refreshToken);
      }, /Refresh token revogado/);
    });
  });

  describe('3. Middleware de Autenticação & Token Expirado', () => {
    it('deve rejeitar requisição sem header Authorization com 401', () => {
      let statusRetornado = 0;
      let bodyRetornado = null;

      const req = { headers: {} };
      const res = {
        status: (s) => {
          statusRetornado = s;
          return {
            json: (b) => { bodyRetornado = b; }
          };
        }
      };

      authMiddleware(req, res, () => {});
      assert.strictEqual(statusRetornado, 401);
      assert.strictEqual(bodyRetornado.error, 'Não autenticado');
    });

    it('deve rejeitar e sinalizar token expirado com 401 e code TOKEN_EXPIRED', () => {
      // Criar token expirado
      const expiredToken = signJwt(
        { sub: 'user-1', email: 'test@ieq.com', igreja_id: IGREJA_MATRIZ, perfil: 'PASTOR' },
        ENV.JWT_SECRET,
        '-1s'
      );

      let statusRetornado = 0;
      let bodyRetornado = null;

      const req = {
        headers: {
          authorization: `Bearer ${expiredToken}`
        }
      };
      const res = {
        status: (s) => {
          statusRetornado = s;
          return {
            json: (b) => { bodyRetornado = b; }
          };
        }
      };

      authMiddleware(req, res, () => {});
      assert.strictEqual(statusRetornado, 401);
      assert.strictEqual(bodyRetornado.error, 'Token expirado');
      assert.strictEqual(bodyRetornado.code, 'TOKEN_EXPIRED');
    });

    it('deve autenticar e popular req.user quando token for válido', () => {
      const tokens = AuthService.gerarTokens(mockPastor);
      let nextChamado = false;

      const req = {
        headers: {
          authorization: `Bearer ${tokens.accessToken}`
        }
      };
      const res = {};

      authMiddleware(req, res, () => { nextChamado = true; });

      assert.strictEqual(nextChamado, true);
      assert.strictEqual(req.user.sub, mockPastor.id);
      assert.strictEqual(req.user.igreja_id, mockPastor.igreja_id);
    });
  });

  describe('4. Middleware de Tenant & Isolamento Multi-tenant', () => {
    it('deve injetar igreja_id da sessão no req', () => {
      let nextChamado = false;
      const req = {
        user: { sub: 'u1', igreja_id: IGREJA_MATRIZ, perfil: 'PASTOR' }
      };

      tenantMiddleware(req, {}, () => { nextChamado = true; });

      assert.strictEqual(nextChamado, true);
      assert.strictEqual(req.igreja_id, IGREJA_MATRIZ);
    });
  });

  describe('5. RBAC & Gestão de Usuários (Acesso Negado entre Perfis)', () => {
    const middlewarePastor = requirePerfil('PASTOR');

    it('deve PERMITIR acesso quando o perfil for PASTOR', () => {
      let nextChamado = false;
      const req = {
        user: { sub: 'u1', igreja_id: IGREJA_MATRIZ, perfil: 'PASTOR' }
      };

      middlewarePastor(req, {}, () => { nextChamado = true; });
      assert.strictEqual(nextChamado, true);
    });

    it('deve NEGAR acesso com 403 Forbidden para perfil CELULA', () => {
      let statusRetornado = 0;
      let bodyRetornado = null;

      const req = {
        user: { sub: 'u2', igreja_id: IGREJA_MATRIZ, perfil: 'CELULA' }
      };
      const res = {
        status: (s) => {
          statusRetornado = s;
          return {
            json: (b) => { bodyRetornado = b; }
          };
        }
      };

      middlewarePastor(req, res, () => {});
      assert.strictEqual(statusRetornado, 403);
      assert.strictEqual(bodyRetornado.error, 'Acesso negado');
      assert.match(bodyRetornado.message, /perfil 'CELULA' não possui permissão/);
    });

    it('deve NEGAR acesso com 403 Forbidden para perfil MIDIA', () => {
      let statusRetornado = 0;
      let bodyRetornado = null;

      const req = {
        user: { sub: 'u3', igreja_id: IGREJA_MATRIZ, perfil: 'MIDIA' }
      };
      const res = {
        status: (s) => {
          statusRetornado = s;
          return {
            json: (b) => { bodyRetornado = b; }
          };
        }
      };

      middlewarePastor(req, res, () => {});
      assert.strictEqual(statusRetornado, 403);
      assert.strictEqual(bodyRetornado.error, 'Acesso negado');
      assert.match(bodyRetornado.message, /perfil 'MIDIA' não possui permissão/);
    });
  });
});
