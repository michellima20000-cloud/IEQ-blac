import { prisma } from '../../config/prisma.ts';
import { validarPermissao } from '../../permissions/rules.ts';
import type { UsuarioAutenticado } from '../../permissions/types.ts';
import type { CriarMembroInput, AtualizarMembroInput, CriarVisitanteInput } from './celulas.schemas.ts';

export class CelulasService {
  /**
   * Valida acesso à célula e retorna a entidade com sua redeId e igreja_id
   */
  static async obterCelula(celulaId: string) {
    const celula = await prisma.celula.findUnique({
      where: { id: celulaId }
    });

    if (!celula) {
      throw new Error('Célula não encontrada.');
    }

    return celula;
  }

  /**
   * Cadastra membro na célula (Líder de Célula na sua própria célula ou Pastor)
   */
  static async criarMembro(usuario: UsuarioAutenticado, celulaId: string, dados: CriarMembroInput) {
    const celula = await this.obterCelula(celulaId);

    // Validação de RBAC e escopo
    validarPermissao(usuario, 'MEMBRO', 'CRIAR', {
      igreja_id: celula.igreja_id,
      redeId: celula.redeId,
      celulaId: celula.id
    });

    return prisma.membro.create({
      data: {
        igreja_id: celula.igreja_id,
        celulaId: celula.id,
        nome: dados.nome,
        telefone: dados.telefone || null,
        dataNascimento: dados.dataNascimento ? new Date(dados.dataNascimento) : null,
        ativo: true
      }
    });
  }

  /**
   * Atualiza dados de membro da célula
   */
  static async atualizarMembro(usuario: UsuarioAutenticado, celulaId: string, membroId: string, dados: AtualizarMembroInput) {
    const celula = await this.obterCelula(celulaId);

    validarPermissao(usuario, 'MEMBRO', 'EDITAR', {
      igreja_id: celula.igreja_id,
      redeId: celula.redeId,
      celulaId: celula.id
    });

    const membro = await prisma.membro.findFirst({
      where: { id: membroId, celulaId: celula.id, igreja_id: usuario.igreja_id }
    });

    if (!membro) {
      throw new Error('Membro não encontrado nesta célula.');
    }

    return prisma.membro.update({
      where: { id: membroId },
      data: {
        ...(dados.nome ? { nome: dados.nome } : {}),
        ...(dados.telefone !== undefined ? { telefone: dados.telefone } : {}),
        ...(dados.dataNascimento !== undefined ? { dataNascimento: dados.dataNascimento ? new Date(dados.dataNascimento) : null } : {}),
        ...(dados.ativo !== undefined ? { ativo: dados.ativo } : {})
      }
    });
  }

  /**
   * Lista membros da célula
   */
  static async listarMembros(usuario: UsuarioAutenticado, celulaId: string) {
    const celula = await this.obterCelula(celulaId);

    validarPermissao(usuario, 'MEMBRO', 'LER', {
      igreja_id: celula.igreja_id,
      redeId: celula.redeId,
      celulaId: celula.id
    });

    return prisma.membro.findMany({
      where: { celulaId: celula.id, igreja_id: usuario.igreja_id },
      orderBy: { nome: 'asc' }
    });
  }

  /**
   * Cadastra visitante na célula
   */
  static async criarVisitante(usuario: UsuarioAutenticado, celulaId: string, dados: CriarVisitanteInput) {
    const celula = await this.obterCelula(celulaId);

    validarPermissao(usuario, 'VISITANTE', 'CRIAR', {
      igreja_id: celula.igreja_id,
      redeId: celula.redeId,
      celulaId: celula.id
    });

    return prisma.visitante.create({
      data: {
        igreja_id: celula.igreja_id,
        celulaId: celula.id,
        nome: dados.nome,
        telefone: dados.telefone || null,
        dataPrimeiraVisita: dados.dataPrimeiraVisita ? new Date(dados.dataPrimeiraVisita) : new Date()
      }
    });
  }

  /**
   * Lista visitantes da célula
   */
  static async listarVisitantes(usuario: UsuarioAutenticado, celulaId: string) {
    const celula = await this.obterCelula(celulaId);

    validarPermissao(usuario, 'VISITANTE', 'LER', {
      igreja_id: celula.igreja_id,
      redeId: celula.redeId,
      celulaId: celula.id
    });

    return prisma.visitante.findMany({
      where: { celulaId: celula.id, igreja_id: usuario.igreja_id },
      orderBy: { dataPrimeiraVisita: 'desc' }
    });
  }
}
