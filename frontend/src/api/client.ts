const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const DEFAULT_URL = isLocal ? 'http://localhost:3001/api/v1' : 'https://ieq-black.onrender.com/api/v1';
const BASE_URL = ((import.meta as any).env?.VITE_API_URL as string) || DEFAULT_URL;

/**
 * Uma foto só pode ser exibida pelo navegador se for data URL (base64)
 * ou uma URL http(s). Valores antigos como `minio://...` quebram a imagem.
 */
export function fotoUtilizavel(url?: string | null): url is string {
  return typeof url === 'string' && (
    url.startsWith('data:') ||
    url.startsWith('http://') ||
    url.startsWith('https://')
  );
}


export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  headers?: HeadersInit;
}

export class ApiClient {
  static getAccessToken(): string | null {
    return typeof localStorage !== 'undefined' ? localStorage.getItem('ieq_access_token') : null;
  }

  static getBaseUrl(): string {
    return BASE_URL;
  }

  static getRefreshToken(): string | null {
    return typeof localStorage !== 'undefined' ? localStorage.getItem('ieq_refresh_token') : null;
  }

  static setTokens(accessToken: string, refreshToken: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('ieq_access_token', accessToken);
      localStorage.setItem('ieq_refresh_token', refreshToken);
    }
    try {
      sessionStorage.removeItem('ieq_sessao_expirada');
    } catch { /* ignore */ }
  }

  static clearTokens(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('ieq_access_token');
      localStorage.removeItem('ieq_refresh_token');
      localStorage.removeItem('ieq_user');
    }
  }

  // Encerra a sessão SEM reload em cascata (loop de reload em PWA/401 persistente)
  private static encerrarSessaoExpirada(): void {
    this.clearTokens();
    if (typeof window === 'undefined') return;
    try {
      if (sessionStorage.getItem('ieq_sessao_expirada') === '1') return; // já redirecionou: evita loop
      sessionStorage.setItem('ieq_sessao_expirada', '1');
    } catch { /* modo privado sem sessionStorage */ }
    window.location.href = '/';
  }

  static async request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    let url = `${BASE_URL}${endpoint}`;

    if (options.params) {
      const searchParams = new URLSearchParams();
      for (const [key, val] of Object.entries(options.params)) {
        if (val !== undefined && val !== null) {
          searchParams.append(key, String(val));
        }
      }
      const qs = searchParams.toString();
      if (qs) url += `?${qs}`;
    }

    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const baseHeaders: Record<string, string> = isFormData
      ? {}
      : { 'Content-Type': 'application/json' };

    const customHeaders: Record<string, string> = {};
    if (options.headers) {
      if (typeof (options.headers as any).forEach === 'function') {
        (options.headers as any).forEach((v: string, k: string) => { customHeaders[k] = v; });
      } else {
        Object.assign(customHeaders, options.headers);
      }
    }

    const headers: Record<string, string> = { ...baseHeaders, ...customHeaders };
    if (isFormData && headers['Content-Type']?.includes('multipart/form-data')) {
      delete headers['Content-Type'];
    }

    const token = this.getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const MAX_TENTATIVAS = 2;

    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS + 1; tentativa++) {
      const response = await fetch(url, {
        method: options.method || 'GET',
        ...options,
        headers: { ...headers, ...(options.headers || {}) }
      });

      if (response.status === 401 && endpoint !== '/auth/login' && endpoint !== '/auth/refresh') {
        const refreshToken = this.getRefreshToken();
        if (refreshToken && tentativa < MAX_TENTATIVAS + 1) {
          try {
            const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken })
            });

            if (refreshRes.ok) {
              const tokens = await refreshRes.json();
              this.setTokens(tokens.accessToken, tokens.refreshToken);
              headers['Authorization'] = `Bearer ${tokens.accessToken}`;
              continue; // Tenta a requisição novamente com novo token
            }
          } catch {
            this.encerrarSessaoExpirada();
            throw new Error('Falha ao renovar token');
          }
        }
        const data = await response.json().catch(() => ({}));
        const err: any = new Error(data.message || data.error || `Erro HTTP ${response.status}`);
        err.response = { data, status: response.status };
        throw err;
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const err: any = new Error(data.message || data.error || `Erro HTTP ${response.status}`);
        err.response = { data, status: response.status };
        throw err;
      }

      const data = await response.json().catch(() => ({}));
      return data as T;
    }

    this.encerrarSessaoExpirada();
    throw new Error('Falha após múltiplas tentativas de refresh de token');
  }

  static get<T = any>(endpoint: string, params?: Record<string, any>): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', params });
  }

  static post<T = any>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: isFormData ? body : JSON.stringify(body)
    });
  }

  static put<T = any>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: isFormData ? body : JSON.stringify(body)
    });
  }

  static patch<T = any>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: isFormData ? body : JSON.stringify(body)
    });
  }

  static delete<T = any>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

// Adaptador compatível com a interface axios `api.get`, `api.post`, etc.
export const api = {
  async get<T = any>(endpoint: string, options?: RequestOptions): Promise<{ data: T }> {
    const data = await ApiClient.request<T>(endpoint, { ...options, method: 'GET' });
    return { data };
  },
  async post<T = any>(endpoint: string, body?: any, options?: RequestOptions): Promise<{ data: T }> {
    const data = await ApiClient.post<T>(endpoint, body, options);
    return { data };
  },
  async put<T = any>(endpoint: string, body?: any, options?: RequestOptions): Promise<{ data: T }> {
    const data = await ApiClient.put<T>(endpoint, body, options);
    return { data };
  },
  async patch<T = any>(endpoint: string, body?: any, options?: RequestOptions): Promise<{ data: T }> {
    const data = await ApiClient.patch<T>(endpoint, body, options);
    return { data };
  },
  async delete<T = any>(endpoint: string, options?: RequestOptions): Promise<{ data: T }> {
    const data = await ApiClient.delete<T>(endpoint, options);
    return { data };
  }
};

export default ApiClient;
