import { prisma } from '../../config/prisma.ts';
import { PermissaoError } from '../../permissions/rules.ts';
import type { UsuarioAutenticado } from '../../permissions/types.ts';
import type { CriarEventoInput, AtualizarEventoInput } from './midia.schemas.ts';

export class CalendarioService {
  /**
   * Criação de evento no calendário da igreja
   */
  static async criar(usuario: UsuarioAutenticado, dados: CriarEventoInput) {
    if (usuario.perfil !== 'MIDIA' && usuario.perfil !== 'PASTOR') {
      throw new PermissaoError('Apenas os perfis Mídia e Pastor podem criar eventos no calendário.');
    }

    return prisma.eventoCalendario.create({
      data: {
        igreja_id: usuario.igreja_id,
        titulo: dados.titulo,
        descricao: dados.descricao || null,
        dataInicio: new Date(dados.dataInicio),
        dataFim: new Date(dados.dataFim),
        local: dados.local || null
      }
    });
  }

  /**
   * Lista todos os eventos da igreja ordenados pela data de início
   */
  static async listar(usuario: UsuarioAutenticado) {
    return prisma.eventoCalendario.findMany({
      where: {
        igreja_id: usuario.igreja_id
      },
      orderBy: { dataInicio: 'asc' }
    });
  }

  /**
   * Atualiza evento existente
   */
  static async atualizar(usuario: UsuarioAutenticado, id: string, dados: AtualizarEventoInput) {
    if (usuario.perfil !== 'MIDIA' && usuario.perfil !== 'PASTOR') {
      throw new PermissaoError('Apenas os perfis Mídia e Pastor podem editar eventos.');
    }

    const evento = await prisma.eventoCalendario.findFirst({
      where: { id, igreja_id: usuario.igreja_id }
    });

    if (!evento) {
      throw new Error('Evento não encontrado nesta igreja.');
    }

    return prisma.eventoCalendario.update({
      where: { id },
      data: {
        ...(dados.titulo ? { titulo: dados.titulo } : {}),
        ...(dados.descricao !== undefined ? { descricao: dados.descricao } : {}),
        ...(dados.dataInicio ? { dataInicio: new Date(dados.dataInicio) } : {}),
        ...(dados.dataFim ? { dataFim: new Date(dados.dataFim) } : {}),
        ...(dados.local !== undefined ? { local: dados.local } : {})
      }
    });
  }

  /**
   * Exclui evento do calendário
   */
  static async excluir(usuario: UsuarioAutenticado, id: string) {
    if (usuario.perfil !== 'MIDIA' && usuario.perfil !== 'PASTOR') {
      throw new PermissaoError('Apenas os perfis Mídia e Pastor podem excluir eventos.');
    }

    const evento = await prisma.eventoCalendario.findFirst({
      where: { id, igreja_id: usuario.igreja_id }
    });

    if (!evento) {
      throw new Error('Evento não encontrado nesta igreja.');
    }

    return prisma.eventoCalendario.delete({
      where: { id }
    });
  }
}

