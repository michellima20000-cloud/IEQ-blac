import crypto from 'node:crypto';

function base64UrlEncode(str: string | Buffer): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

export function signJwt(payload: Record<string, any>, secret: string, expiresIn: string = '15m'): string {
  const header = { alg: 'HS256', typ: 'JWT' };

  let expSeconds = 15 * 60; // padrão 15m
  if (expiresIn.endsWith('s')) expSeconds = parseInt(expiresIn, 10);
  else if (expiresIn.endsWith('m')) expSeconds = parseInt(expiresIn, 10) * 60;
  else if (expiresIn.endsWith('d')) expSeconds = parseInt(expiresIn, 10) * 86400;

  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expSeconds
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto.createHmac('sha256', secret).update(data).digest();
  const encodedSignature = base64UrlEncode(signature);

  return `${data}.${encodedSignature}`;
}

export function verifyJwt(token: string, secret: string): any {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Token mal formatado.');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const data = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = base64UrlEncode(crypto.createHmac('sha256', secret).update(data).digest());
  if (expectedSignature !== encodedSignature) {
    throw new Error('Assinatura do token inválida.');
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload));
  const now = Math.floor(Date.now() / 1000);

  if (payload.exp && payload.exp < now) {
    const err: any = new Error('jwt expired');
    err.name = 'TokenExpiredError';
    throw err;
  }

  return payload;
}

function scryptAsync(password: string, salt: string, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey as Buffer);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt, 64);
  return `$scrypt$${salt}$${derivedKey.toString('hex')}`;
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  try {
    if (hash.startsWith('$scrypt$')) {
      const parts = hash.split('$');
      const salt = parts[2];
      const key = parts[3];
      if (!salt || !key) return false;
      const derivedKey = await scryptAsync(password, salt, 64);
      return crypto.timingSafeEqual(Buffer.from(key, 'hex'), derivedKey);
    }

    // Hash bcrypt legado — não suportado sem módulo nativo
    // Nunca deve chegar aqui em produção (seed usa scrypt)
    return false;
  } catch {
    return false;
  }
}

