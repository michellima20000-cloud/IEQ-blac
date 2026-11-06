import React, { createContext, useContext, useState, useEffect } from 'react';
import { ApiClient } from '../api/client';

export type Perfil = 'CELULA' | 'REDE' | 'PASTOR' | 'MIDIA';

export interface UsuarioLogado {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
  redeId?: string | null;
  celulaId?: string | null;
  igreja?: {
    id: string;
    nome: string;
    slug: string;
  };
}

interface AuthContextType {
  usuario: UsuarioLogado | null;
  autenticado: boolean;
  carregando: boolean;
  login: (email: string, senha: string, slugIgreja: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const usuarioSalvo = localStorage.getItem('ieq_user');
    const token = localStorage.getItem('ieq_access_token');

    if (usuarioSalvo && token) {
      try {
        setUsuario(JSON.parse(usuarioSalvo));
      } catch {
        ApiClient.clearTokens();
      }
    }
    setCarregando(false);
  }, []);

  const login = async (email: string, senha: string, slugIgreja: string) => {
    const res = await ApiClient.post('/auth/login', { email, senha, slugIgreja });
    ApiClient.setTokens(res.accessToken, res.refreshToken);
    localStorage.setItem('ieq_user', JSON.stringify(res.usuario));
    setUsuario(res.usuario);
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('ieq_refresh_token');
    try {
      if (refreshToken) {
        await ApiClient.post('/auth/logout', { refreshToken });
      }
    } catch {
      // Ignora erro no logout
    } finally {
      ApiClient.clearTokens();
      setUsuario(null);
    }
  };

  return (
    <AuthContext.Provider value={{ usuario, autenticado: !!usuario, carregando, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

