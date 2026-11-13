import { ENV } from '../config/env.ts';
import { verifyJwt } from '../config/cryptoUtils.ts';
import type { Perfil } from '../permissions/types.ts';

export interface TokenPayload {
  sub: string;
  email: string;
  igreja_id: string;
  perfil: Perfil;
  redeId?: string | null;
  celulaId?: string | null;
}

export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: TokenPayload;
  igreja_id?: string;
  [key: string]: any;
}

export function authMiddleware(req: AuthenticatedRequest, res: any, next: (err?: any) => void): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      error: 'Não autenticado',
      message: 'Token de autorização não fornecido no header Authorization.'
    });
    return;
  }

  const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  const parts = headerValue.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    res.status(401).json({
      error: 'Token inválido',
      message: 'Formato do token inválido. Esperado: Bearer <token>'
    });
    return;
  }

  const token = parts[1];

  try {
    const decoded = verifyJwt(token, ENV.JWT_SECRET) as any;
    decoded.id = decoded.sub; // Garante que usuario.id seja sempre igual a usuario.sub
    req.user = decoded;
    req.igreja_id = decoded.igreja_id;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({
        error: 'Token expirado',
        message: 'O token de acesso expirou. Utilize o refresh token para renovar.',
        code: 'TOKEN_EXPIRED'
      });
      return;
    }

    res.status(401).json({
      error: 'Token inválido',
      message: 'Falha na verificação da assinatura do token.'
    });
  }
}
