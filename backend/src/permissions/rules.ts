import type { UsuarioAutenticado, Recurso, Acao, EntidadeAlvo } from './types.ts';

export class PermissaoError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 403) {
    super(message);
    this.name = 'PermissaoError';
    this.statusCode = statusCode;
  }
}

/**
 * Validador Central de Regras de Permissão (RBAC) e Isolamento Multi-tenant
 * 
 * Lança PermissaoError quando o acesso é negado.
 * Retorna true quando o acesso é permitido.
 * 
 * Padrão: throw on deny, return true on allow.
 */
export function validarPermissao(
  usuario: UsuarioAutenticado,
  recurso: Recurso,
  acao: Acao,
  alvo: EntidadeAlvo
): true {
  // 0. SUPERUSUÁRIO (ADM): acesso irrestrito a TODAS as igrejas (bypass de tenant)
  if (usuario.perfil === 'ADM') {
    return true;
  }

  // 1. ISOLAMENTO MULTI-TENANT: Ninguém acessa dados de outra igreja
  if (usuario.igreja_id !== alvo.igreja_id) {
    throw new PermissaoError('Acesso negado: Tentativa de acesso a dados de outra igreja.');
  }

  // 2. REGRA DO PERFIL MÍDIA: Nunca acessa células, membros, visitantes ou relatórios
  if (usuario.perfil === 'MIDIA') {
    if (['CELULA', 'MEMBRO', 'VISITANTE', 'RELATORIO'].includes(recurso)) {
      throw new PermissaoError('Acesso negado: Perfil Mídia não possui acesso ao módulo de células.');
    }
    // Mídia pode acessar recursos próprios (não célula/relatório/membro/visitante)
    return true;
  }

  // 3. REGRA DO PASTOR: Acesso irrestrito a todos os recursos da sua igreja
  if (usuario.perfil === 'PASTOR') {
    return true;
  }

  // 4. REGRA DO LÍDER DE REDE:
  if (usuario.perfil === 'REDE') {
    if (['CELULA', 'MEMBRO', 'VISITANTE', 'RELATORIO'].includes(recurso)) {
      // Líder de rede só acessa células pertencentes à sua rede.
      // Sem rede vinculada não há escopo definido: o acesso é NEGADO
      // (falhar em branco daria acesso a todas as células da igreja).
      if (!usuario.redeId) {
        throw new PermissaoError('Acesso negado: Líder de rede sem rede vinculada. Fale com o Pastor.');
      }
      if (alvo.redeId !== usuario.redeId) {
        throw new PermissaoError('Acesso negado: Líder de rede só pode acessar células da sua própria rede.');
      }
      return true;
    }

    if (recurso === 'MIDIA') {
      // Apenas leitura da vitrine
      if (acao === 'LER') return true;
      throw new PermissaoError('Acesso negado: Líder de rede não gerencia mídias.');
    }

    throw new PermissaoError(`Acesso negado para o recurso ${recurso}.`);
  }

  // 5. REGRA DO LÍDER DE CÉLULA:
  if (usuario.perfil === 'CELULA') {
    if (['CELULA', 'MEMBRO', 'VISITANTE', 'RELATORIO'].includes(recurso)) {
      // Líder de célula só acessa a sua própria célula.
      // Sem célula vinculada o acesso é NEGADO (nunca liberado para todas).
      if (!usuario.celulaId) {
        throw new PermissaoError('Acesso negado: Líder de célula sem célula vinculada. Fale com o Pastor.');
      }
      if (alvo.celulaId !== usuario.celulaId) {
        throw new PermissaoError('Acesso negado: Líder de célula só pode acessar a sua própria célula.');
      }
      return true;
    }

    if (recurso === 'MIDIA') {
      if (acao === 'LER') return true;
      throw new PermissaoError('Acesso negado: Líder de célula não gerencia mídias.');
    }

    throw new PermissaoError(`Acesso negado para o recurso ${recurso}.`);
  }

  throw new PermissaoError('Acesso negado: Perfil não reconhecido.');
}
