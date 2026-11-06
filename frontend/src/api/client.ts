const BASE_URL = ((import.meta as any).env?.VITE_API_URL as string) || 'http://localhost:3001/api/v1';

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  headers?: HeadersInit;
}

export class ApiClient {
  static getAccessToken(): string | null {
    return typeof localStorage !== 'undefined' ? localStorage.getItem('ieq_access_token') : null;
  }

  static getRefreshToken(): string | null {
    return typeof localStorage !== 'undefined' ? localStorage.getItem('ieq_refresh_token') : null;
  }

  static setTokens(accessToken: string, refreshToken: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('ieq_access_token', accessToken);
      localStorage.setItem('ieq_refresh_token', refreshToken);
    }
  }

  static clearTokens(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('ieq_access_token');
      localStorage.removeItem('ieq_refresh_token');
      localStorage.removeItem('ieq_user');
    }
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

    const response = await fetch(url, {
      ...options,
      headers
    });

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
          if (typeof window !== 'undefined') window.location.reload();
        }
      }
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const err: any = new Error(data.message || data.error || `Erro HTTP ${response.status}`);
      err.response = { data, status: response.status };
      throw err;
    }

    return data as T;
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
