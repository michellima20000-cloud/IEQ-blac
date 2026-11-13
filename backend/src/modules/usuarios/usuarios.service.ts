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

    let redeId = dados.redeId || null;
    let celulaId = dados.celulaId || null;

    // Se for Líder de Rede e informou o nome da rede
    if (dados.perfil === 'REDE') {
      if (dados.nomeRede && dados.nomeRede.trim()) {
        const nomeFormatado = dados.nomeRede.trim();
        let rede = await prisma.rede.findFirst({
          where: {
            igreja_id,
            nome: { equals: nomeFormatado, mode: 'insensitive' }
          }
        });
        if (!rede) {
          rede = await prisma.rede.create({
            data: {
              nome: nomeFormatado,
              igreja_id
            }
          });
        }
        redeId = rede.id;
      }
    }

    // Se for Líder de Célula e informou número/identificador da célula
    if (dados.perfil === 'CELULA') {
      // 1. Resolver a Rede
      let rede = null;
      if (redeId) {
        rede = await prisma.rede.findFirst({ where: { id: redeId, igreja_id } });
      } else if (dados.nomeRede && dados.nomeRede.trim()) {
        const nomeRedeFormatado = dados.nomeRede.trim();
        rede = await prisma.rede.findFirst({
          where: {
            igreja_id,
            nome: { equals: nomeRedeFormatado, mode: 'insensitive' }
          }
        });
        if (!rede) {
          rede = await prisma.rede.create({
            data: {
              nome: nomeRedeFormatado,
              igreja_id
            }
          });
        }
      }

      if (!rede) {
        rede = await prisma.rede.findFirst({ where: { igreja_id } });
        if (!rede) {
          rede = await prisma.rede.create({
            data: {
              nome: 'Rede Geral',
              igreja_id
            }
          });
        }
      }
      redeId = rede.id;

      // 2. Resolver a Célula por número ou nome
      if (dados.identificadorCelula && dados.identificadorCelula.trim()) {
        const idLimpo = dados.identificadorCelula.trim();
        const nomeCelula = idLimpo.toLowerCase().startsWith('célula') || idLimpo.toLowerCase().startsWith('celula')
          ? idLimpo
          : `Célula ${idLimpo}`;

        let celula = await prisma.celula.findFirst({
          where: {
            igreja_id,
            nome: { equals: nomeCelula, mode: 'insensitive' }
          }
        });

        if (!celula) {
          celula = await prisma.celula.create({
            data: {
              nome: nomeCelula,
              diaSemana: 'Sábado',
              horario: '19:30',
              endereco: 'Sede / Residencial',
              redeId: rede.id,
              igreja_id
            }
          });
        }
        celulaId = celula.id;
      }
    }

    const senhaHash = await AuthService.hashSenha(dados.senha);

    return prisma.usuario.create({
      data: {
        igreja_id,
        nome: dados.nome,
        email: dados.email,
        senhaHash,
        perfil: dados.perfil as any,
        redeId,
        celulaId,
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
        createdAt: true,
        celula: {
          select: {
            id: true,
            nome: true,
            rede: { select: { id: true, nome: true } }
          }
        },
        rede: {
          select: { id: true, nome: true }
        }
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
        createdAt: true,
        celula: {
          select: {
            id: true,
            nome: true,
            rede: { select: { id: true, nome: true } }
          }
        },
        rede: {
          select: { id: true, nome: true }
        }
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
        createdAt: true,
        celula: {
          select: {
            id: true,
            nome: true,
            rede: { select: { id: true, nome: true } }
          }
        },
        rede: {
          select: { id: true, nome: true }
        }
      }
    });

    if (!usuario) {
      throw new Error('Usuário não encontrado nesta igreja.');
    }

    return usuario;
  }

  /**
   * Atualiza usuário da igreja (nome, e-mail, senha, perfil, vínculos e status)
   *
   * `perfilSolicitante` impede que um Pastor altere (ou troque a senha de) uma
   * conta ADM: o perfil ADM enxerga todas as igrejas.
   */
  static async atualizar(
    igreja_id: string,
    id: string,
    dados: AtualizarUsuarioInput,
    perfilSolicitante?: string
  ) {
    const usuario = await this.buscarPorId(igreja_id, id);

    const ehAdministrador = perfilSolicitante === 'ADM';
    if (usuario.perfil === 'ADM' && !ehAdministrador) {
      throw new Error('Somente o Administrador do sistema pode alterar uma conta ADM.');
    }
    if (dados.perfil === 'ADM' && !ehAdministrador) {
      throw new Error('Somente o Administrador do sistema pode conceder o perfil ADM.');
    }

    // E-mail duplicado na mesma igreja
    if (dados.email && dados.email.toLowerCase() !== usuario.email.toLowerCase()) {
      const existente = await prisma.usuario.findFirst({
        where: { igreja_id, email: dados.email }
      });
      if (existente) {
        throw new Error('Já existe um usuário cadastrado com este e-mail nesta igreja.');
      }
    }

    const perfilFinal = (dados.perfil ?? usuario.perfil) as any;

    let redeId = dados.redeId !== undefined ? dados.redeId : usuario.redeId;
    let celulaId = dados.celulaId !== undefined ? dados.celulaId : usuario.celulaId;

    if (perfilFinal === 'MIDIA' || perfilFinal === 'ADM') {
      // Equipe de mídia e Administrador não possuem vínculos de célula/rede
      redeId = null;
      celulaId = null;
    } else if (perfilFinal === 'PASTOR') {
      // Pastor mantém os vínculos atuais, salvo alteração explícita
    } else {
      if (perfilFinal === 'REDE') {
        // Líder de rede não pertence a uma célula
        celulaId = null;
      }

      if (dados.nomeRede && dados.nomeRede.trim()) {
        const nomeFormatado = dados.nomeRede.trim();
        let rede = await prisma.rede.findFirst({
          where: {
            igreja_id,
            nome: { equals: nomeFormatado, mode: 'insensitive' }
          }
        });
        if (!rede) {
          rede = await prisma.rede.create({
            data: { nome: nomeFormatado, igreja_id }
          });
        }
        redeId = rede.id;
      }

      if (dados.identificadorCelula && dados.identificadorCelula.trim()) {
        const idLimpo = dados.identificadorCelula.trim();
        const nomeCelula = idLimpo.toLowerCase().startsWith('célula') || idLimpo.toLowerCase().startsWith('celula')
          ? idLimpo
          : `Célula ${idLimpo}`;

        let celula = await prisma.celula.findFirst({
          where: {
            igreja_id,
            nome: { equals: nomeCelula, mode: 'insensitive' }
          }
        });

        if (!celula) {
          let redeParaCelula = redeId ? await prisma.rede.findUnique({ where: { id: redeId } }) : null;
          if (!redeParaCelula) {
            redeParaCelula = await prisma.rede.findFirst({ where: { igreja_id } });
            if (!redeParaCelula) {
              redeParaCelula = await prisma.rede.create({
                data: { nome: 'Rede Geral', igreja_id }
              });
            }
          }
          celula = await prisma.celula.create({
            data: {
              nome: nomeCelula,
              diaSemana: 'Sábado',
              horario: '19:30',
              endereco: 'Sede / Residencial',
              redeId: redeParaCelula.id,
              igreja_id
            }
          });
        }
        celulaId = celula.id;
        redeId = celula.redeId;
      }
    }

    return prisma.usuario.update({
      where: { id },
      data: {
        ...(dados.nome ? { nome: dados.nome } : {}),
        ...(dados.email ? { email: dados.email } : {}),
        ...(dados.senha ? { senhaHash: await AuthService.hashSenha(dados.senha) } : {}),
        ...(dados.perfil ? { perfil: perfilFinal } : {}),
        ...(dados.ativo !== undefined ? { ativo: dados.ativo } : {}),
        redeId,
        celulaId
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
        updatedAt: true,
        celula: {
          select: {
            id: true,
            nome: true,
            rede: { select: { id: true, nome: true } }
          }
        },
        rede: {
          select: { id: true, nome: true }
        }
      }
    });
  }

  /**
   * Exclui um usuário da igreja.
   * Se o usuário possuir relatórios/conteúdos vinculados (FK Restrict),
   * ele é apenas desativado (ativo = false) para preservar o histórico.
   */
  static async excluir(igreja_id: string, id: string, idSolicitante?: string) {
    const usuario = await this.buscarPorId(igreja_id, id);

    if (idSolicitante && id === idSolicitante) {
      throw new Error('Você não pode excluir o próprio usuário.');
    }

    const [totalRelatorios, totalConteudos] = await Promise.all([
      prisma.relatorioCelula.count({ where: { liderId: id } }),
      prisma.conteudoMidia.count({ where: { autorId: id } })
    ]);

    if (totalRelatorios + totalConteudos > 0) {
      const desativado = await prisma.usuario.update({
        where: { id },
        data: { ativo: false },
        select: {
          id: true,
          nome: true,
          email: true,
          perfil: true,
          ativo: true
        }
      });

      return {
        modo: 'desativado' as const,
        usuario: desativado,
        mensagem: `"${usuario.nome}" possui dados vinculados (relatórios/conteúdos) e foi apenas desativado — o acesso dele foi bloqueado.`
      };
    }

    await prisma.usuario.delete({ where: { id } });

    return {
      modo: 'excluido' as const,
      usuario,
      mensagem: `Usuário "${usuario.nome}" excluído com sucesso.`
    };
  }
}

