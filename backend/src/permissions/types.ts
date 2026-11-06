export type Perfil = 'CELULA' | 'REDE' | 'PASTOR' | 'MIDIA';

export interface UsuarioAutenticado {
  id: string;
  igreja_id: string;
  perfil: Perfil;
  redeId?: string | null;
  celulaId?: string | null;
}

export type Recurso = 'CELULA' | 'MEMBRO' | 'VISITANTE' | 'RELATORIO' | 'MIDIA' | 'CONFIGURACAO' | 'USUARIO';
export type Acao = 'CRIAR' | 'LER' | 'EDITAR' | 'EXCLUIR' | 'FECHAR';

export interface EntidadeAlvo {
  igreja_id: string;
  redeId?: string | null;
  celulaId?: string | null;
}

