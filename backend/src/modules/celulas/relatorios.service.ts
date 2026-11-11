import { prisma } from '../../config/prisma.ts';
import { validarPermissao, PermissaoError } from '../../permissions/rules.ts';
import { StorageService } from '../../services/storage.service.ts';
import { signJwt, verifyJwt } from '../../config/cryptoUtils.ts';
import { ENV } from '../../config/env.ts';
import type { UsuarioAutenticado } from '../../permissions/types.ts';
import type { CriarRelatorioInput, AtualizarRelatorioInput } from './celulas.schemas.ts';

export class RelatoriosService {
  /**
   * Cria relatório semanal em status ABERTO
   */
  static async criar(usuario: UsuarioAutenticado, celulaId: string, dados: CriarRelatorioInput) {
    const celula = await prisma.celula.findUnique({
      where: { id: celulaId }
    });

    if (!celula) {
      throw new Error('Célula não encontrada.');
    }

    validarPermissao(usuario, 'RELATORIO', 'CRIAR', {
      igreja_id: celula.igreja_id,
      redeId: celula.redeId,
      celulaId: celula.id
    });

    const liderId = usuario.id || (usuario as any).sub;
    if (!liderId) {
      throw new Error('Identificação do líder inválida.');
    }

    return prisma.relatorioCelula.create({
      data: {
        igreja_id: celula.igreja_id,
        celulaId: celula.id,
        liderId,
        data: new Date(dados.data),
        presentes: dados.presentes,
        visitantes: dados.visitantes,
        observacoes: dados.observacoes || null,
        fotoUrl: dados.fotoUrl || null,
        status: 'ABERTO'
      }
    });
  }

/**
 * Edita relatório semanal.
 * REGRA MANDATÓRIA: Depois de fechado, o relatório NÃO pode ser editado.
 * EXCEÇÃO: Líder de Rede da mesma rede pode editar relatórios fechados para correção.
 */
static async atualizar(usuario: UsuarioAutenticado, relatorioId: string, dados: AtualizarRelatorioInput) {
    const relatorio = await prisma.relatorioCelula.findUnique({
      where: { id: relatorioId },
      include: { celula: true }
    });

    if (!relatorio) {
      throw new Error('Relatório não encontrado.');
    }

    validarPermissao(usuario, 'RELATORIO', 'EDITAR', {
      igreja_id: relatorio.igreja_id,
      redeId: relatorio.celula.redeId,
      celulaId: relatorio.celulaId
    });

    // TRAVA DE SEGURANÇA: Relatório fechado não pode ser editado
    // EXCEÇÃO: Líder de Rede da mesma rede pode editar relatórios fechados
    const usuarioEhLiderRede = usuario.perfil === 'REDE' && usuario.redeId === relatorio.celula.redeId;
    if (relatorio.status === 'FECHADO' && !usuarioEhLiderRede) {
      throw new PermissaoError('Relatório fechado não pode ser editado.');
    }

    return prisma.relatorioCelula.update({
      where: { id: relatorioId },
      data: {
        ...(dados.data ? { data: new Date(dados.data) } : {}),
        ...(dados.presentes !== undefined ? { presentes: dados.presentes } : {}),
        ...(dados.visitantes !== undefined ? { visitantes: dados.visitantes } : {}),
        ...(dados.observacoes !== undefined ? { observacoes: dados.observacoes } : {}),
        ...(dados.fotoUrl !== undefined ? { fotoUrl: dados.fotoUrl } : {}),
        ...(dados.manterFoto !== undefined ? { manterFoto: dados.manterFoto } : {})
      }
    });
  }

  /**
   * Ação "Fechar Relatório": Torna o relatório imutável para edição
   */
  static async fechar(usuario: UsuarioAutenticado, relatorioId: string) {
    const relatorio = await prisma.relatorioCelula.findUnique({
      where: { id: relatorioId },
      include: { celula: true }
    });

    if (!relatorio) {
      throw new Error('Relatório não encontrado.');
    }

    validarPermissao(usuario, 'RELATORIO', 'FECHAR', {
      igreja_id: relatorio.igreja_id,
      redeId: relatorio.celula.redeId,
      celulaId: relatorio.celulaId
    });

    if (relatorio.status === 'FECHADO') {
      throw new Error('Este relatório já está fechado.');
    }

    return prisma.relatorioCelula.update({
      where: { id: relatorioId },
      data: {
        status: 'FECHADO',
        dataFechamento: new Date()
      }
    });
  }

/**
 * Exclui relatório semanal definitivamente.
 * Se o relatório possuir foto vinculada, a foto é removida do armazenamento.
 * EXCEÇÃO: Líder de Rede da mesma rede pode excluir relatórios fechados.
 * Relatório fechado NÃO pode ser excluído pelos líderes de célula comuns.
 */
static async excluir(usuario: UsuarioAutenticado, relatorioId: string) {
    const relatorio = await prisma.relatorioCelula.findUnique({
      where: { id: relatorioId },
      include: { celula: true }
    });

    if (!relatorio) {
      throw new Error('Relatório não encontrado.');
    }

    validarPermissao(usuario, 'RELATORIO', 'EXCLUIR', {
      igreja_id: relatorio.igreja_id,
      redeId: relatorio.celula.redeId,
      celulaId: relatorio.celulaId
    });

    // TRAVA DE SEGURANÇA: Relatório fechado não pode ser excluído,
    // EXCEÇÃO: Líder de Rede da mesma rede pode excluir relatórios fechados
    const usuarioEhLiderRede = usuario.perfil === 'REDE' && usuario.redeId === relatorio.celula.redeId;
    if (relatorio.status === 'FECHADO' && !usuarioEhLiderRede) {
      throw new PermissaoError('Relatório fechado não pode ser excluído. Use a opção de editar para correção ou aguarde o pastor.');
    }

    // Remove foto do armazenamento se existir (não bloqueia a exclusão do registro)
    if (relatorio.fotoUrl && !relatorio.fotoUrl.startsWith('data:')) {
      try {
        const key = relatorio.fotoUrl.replace(/^minio:\/\/[^\/]+\//, '');
        await StorageService.excluir(key);
      } catch (err) {
        console.error('Falha ao remover foto do armazenamento:', err);
      }
    }

    // Exclusão definitiva do relatório
    return prisma.relatorioCelula.delete({
      where: { id: relatorioId }
    });
  }

  /**
   * Gera URL assinada com expiração de 15 minutos para foto do relatório
   */
  static gerarUrlAssinadaFoto(relatorioId: string): string {
    // O token carrega APENAS a referência (a foto pode ter vários MB;
    // embutir o base64 no JWT geraria URLs gigantes e falharia no servidor)
    const tokenAssinado = signJwt({
      tipo: 'FOTO_RELATORIO',
      relatorioId
    }, ENV.JWT_SECRET, '15m');

    return `/api/v1/relatorios/${relatorioId}/foto?token=${tokenAssinado}`;
  }

  /**
   * Valida URL assinada e registra no log de auditoria
   */
  static async registrarAcessoFoto(usuario: UsuarioAutenticado, relatorioId: string, token: string, ip?: string) {
    // 1. Valida a assinatura do token
    const decoded = verifyJwt(token, ENV.JWT_SECRET);
    if (decoded.tipo !== 'FOTO_RELATORIO' || decoded.relatorioId !== relatorioId) {
      throw new Error('Token de visualização inválido.');
    }

    const relatorio = await prisma.relatorioCelula.findUnique({
      where: { id: relatorioId },
      include: { celula: true }
    });

    if (!relatorio || !relatorio.fotoUrl) {
      throw new Error('Foto do relatório não encontrada.');
    }

    // 2. Valida permissão de acesso ao relatório
    validarPermissao(usuario, 'RELATORIO', 'LER', {
      igreja_id: relatorio.igreja_id,
      redeId: relatorio.celula.redeId,
      celulaId: relatorio.celulaId
    });

    const uid = usuario.id || (usuario as any).sub;
    // Referência curta da foto no log (evita gravar base64 inteiro na auditoria)
    const referenciaFoto = relatorio.fotoUrl.startsWith('data:')
      ? `${relatorio.fotoUrl.slice(0, 48)}...(${relatorio.fotoUrl.length} chars)`
      : relatorio.fotoUrl;

    // 3. Registra no Log de Auditoria
    await prisma.logAuditoria.create({
      data: {
        igreja_id: relatorio.igreja_id,
        usuarioId: uid,
        acao: 'VISUALIZAR_FOTO_RELATORIO',
        recurso: `RelatorioCelula:${relatorioId}`,
        detalhesJson: JSON.stringify({
          // guarda apenas a referência (a foto pode ter vários MB em base64)
          fotoUrl: relatorio.fotoUrl.startsWith('data:')
            ? `${relatorio.fotoUrl.slice(0, 48)}...(${relatorio.fotoUrl.length} chars)`
            : relatorio.fotoUrl,
          visualizadoPor: uid,
          perfil: usuario.perfil,
          data: new Date().toISOString()
        }),
        ip: ip || null
      }
    });

    return relatorio.fotoUrl;
  }
}

