const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

export class ApiClient {
  private static getAccessToken(): string | null {
    return localStorage.getItem('ieq_access_token');
  }

  private static getRefreshToken(): string | null {
    return localStorage.getItem('ieq_refresh_token');
  }

  static setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem('ieq_access_token', accessToken);
    localStorage.setItem('ieq_refresh_token', refreshToken);
  }

  static clearTokens(): void {
    localStorage.removeItem('ieq_access_token');
    localStorage.removeItem('ieq_refresh_token');
    localStorage.removeItem('ieq_user');
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

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    const token = this.getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    // Se o token expirou (401), tenta renovar usando o refresh token
    if (response.status === 401 && endpoint !== '/auth/login' && endpoint !== '/auth/refresh') {
      const refreshToken = this.getRefreshToken();
      if (refreshToken) {
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

            const retryResponse = await fetch(url, { ...options, headers });
            if (!retryResponse.ok) {
              const err = await retryResponse.json();
              throw new Error(err.message || 'Erro na requisição');
            }
            return retryResponse.json();
          }
        } catch {
          this.clearTokens();
          window.location.reload();
        }
      }
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || data.error || `Erro HTTP ${response.status}`);
    }

    return data as T;
  }

  static get<T = any>(endpoint: string, params?: Record<string, any>): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', params });
  }

  static post<T = any>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', body: JSON.stringify(body) });
  }

  static patch<T = any>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(body) });
  }

  static delete<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

