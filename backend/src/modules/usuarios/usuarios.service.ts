import { prisma } from '../../config/prisma.ts';
import { AuthService } from '../auth/auth.service.ts';
import type { CriarUsuarioInput, AtualizarUsuarioInput } from './usuarios.schemas.ts';

export class UsuariosService {
  /**
   * Cria um novo usuário (Líder de Célula, Líder de Rede ou Mídia) dentro da igreja
   */
  static async criar(igreja_id: string, dados: CriarUsuarioInput) {
    // Verificar se já existe usuário com este e-mail na mesma igreja
    const existente = await prisma.usuario.findFirst({
      where: {
        igreja_id,
        email: dados.email
      }
    });

    if (existente) {
      throw new Error('Já existe um usuário cadastrado com este e-mail nesta igreja.');
    }

    const senhaHash = await AuthService.hashSenha(dados.senha);

    return prisma.usuario.create({
      data: {
        igreja_id,
        nome: dados.nome,
        email: dados.email,
        senhaHash,
        perfil: dados.perfil as any,
        redeId: dados.redeId || null,
        celulaId: dados.celulaId || null,
        ativo: true
      },
      select: {
        id: true,
        igreja_id: true,
        nome: true,
        email: true,
        perfil: true,
        redeId: true,
        celulaId: true,
        ativo: true,
        createdAt: true
      }
    });
  }

  /**
   * Lista os usuários da igreja do pastor autenticado com filtro opcional por perfil
   */
  static async listar(igreja_id: string, perfilFiltro?: string) {
    return prisma.usuario.findMany({
      where: {
        igreja_id,
        ...(perfilFiltro ? { perfil: perfilFiltro as any } : {})
      },
      select: {
        id: true,
        igreja_id: true,
        nome: true,
        email: true,
        perfil: true,
        redeId: true,
        celulaId: true,
        ativo: true,
        createdAt: true
      },
      orderBy: {
        nome: 'asc'
      }
    });
  }

  /**
   * Obtém detalhes de um usuário garantindo o isolamento da igreja
   */
  static async buscarPorId(igreja_id: string, id: string) {
    const usuario = await prisma.usuario.findFirst({
      where: {
        id,
        igreja_id
      },
      select: {
        id: true,
        igreja_id: true,
        nome: true,
        email: true,
        perfil: true,
        redeId: true,
        celulaId: true,
        ativo: true,
        createdAt: true
      }
    });

    if (!usuario) {
      throw new Error('Usuário não encontrado nesta igreja.');
    }

    return usuario;
  }

  /**
   * Atualiza ou desativa usuário da igreja
   */
  static async atualizar(igreja_id: string, id: string, dados: AtualizarUsuarioInput) {
    await this.buscarPorId(igreja_id, id);

    return prisma.usuario.update({
      where: { id },
      data: {
        ...(dados.nome ? { nome: dados.nome } : {}),
        ...(dados.ativo !== undefined ? { ativo: dados.ativo } : {}),
        ...(dados.redeId !== undefined ? { redeId: dados.redeId } : {}),
        ...(dados.celulaId !== undefined ? { celulaId: dados.celulaId } : {})
      },
      select: {
        id: true,
        igreja_id: true,
        nome: true,
        email: true,
        perfil: true,
        redeId: true,
        celulaId: true,
        ativo: true,
        updatedAt: true
      }
    });
  }
}
