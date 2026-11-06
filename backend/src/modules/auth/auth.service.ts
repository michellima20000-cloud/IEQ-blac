import { ENV } from '../../config/env.ts';
import { signJwt, verifyJwt, hashPassword, comparePassword } from '../../config/cryptoUtils.ts';
import type { Perfil } from '../../permissions/types.ts';
import type { TokenPayload } from '../../middlewares/auth.ts';

const revokedRefreshTokens = new Set<string>();

export interface UsuarioAuthResult {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
  igreja_id: string;
  redeId?: string | null;
  celulaId?: string | null;
}

export class AuthService {
  /**
   * Gera um par de tokens (Access Token de 15min + Refresh Token de 7 dias)
   */
  static gerarTokens(usuario: UsuarioAuthResult) {
    const payload: TokenPayload = {
      sub: usuario.id,
      email: usuario.email,
      igreja_id: usuario.igreja_id,
      perfil: usuario.perfil,
      redeId: usuario.redeId,
      celulaId: usuario.celulaId
    };

    const accessToken = signJwt(payload, ENV.JWT_SECRET, ENV.JWT_ACCESS_EXPIRES_IN);
    const refreshToken = signJwt(
      { sub: usuario.id, igreja_id: usuario.igreja_id, type: 'refresh' },
      ENV.JWT_REFRESH_SECRET,
      ENV.JWT_REFRESH_EXPIRES_IN
    );

    return { accessToken, refreshToken, expiresIn: '15m' };
  }

  /**
   * Compara senha informada com o hash salvo
   */
  static async verificarSenha(senhaPlana: string, senhaHash: string): Promise<boolean> {
    return comparePassword(senhaPlana, senhaHash);
  }

  /**
   * Criptografa nova senha
   */
  static async hashSenha(senhaPlana: string): Promise<string> {
    return hashPassword(senhaPlana);
  }

  /**
   * Invalida um refresh token (logout)
   */
  static revogarRefreshToken(refreshToken: string): void {
    revokedRefreshTokens.add(refreshToken);
  }

  /**
   * Valida e decodifica o refresh token
   */
  static verificarRefreshToken(refreshToken: string): { sub: string; igreja_id: string } {
    if (revokedRefreshTokens.has(refreshToken)) {
      throw new Error('Refresh token revogado.');
    }

    try {
      const decoded = verifyJwt(refreshToken, ENV.JWT_REFRESH_SECRET) as any;
      if (decoded.type !== 'refresh') {
        throw new Error('Token inválido.');
      }
      return { sub: decoded.sub, igreja_id: decoded.igreja_id };
    } catch {
      throw new Error('Refresh token inválido ou expirado.');
    }
  }
}
