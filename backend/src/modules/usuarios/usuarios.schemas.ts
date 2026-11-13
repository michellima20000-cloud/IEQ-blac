import { z } from '../../config/zodFallback.ts';

// O perfil ADM (superusuário) NUNCA pode ser concedido pelo Pastor:
// um ADM enxerga todas as igrejas. A gestão de ADM fica com o módulo /admin,
// que usa os próprios schemas (admin.schemas.ts).
export const PERFIS_GERENCIAVEIS = ['CELULA', 'REDE', 'MIDIA', 'PASTOR'] as const;

export const criarUsuarioSchema = z.object({
  nome: z.string().min(3, 'O nome deve ter no mínimo 3 caracteres'),
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres'),
  perfil: z.enum(PERFIS_GERENCIAVEIS, {
    errorMap: () => ({ message: 'Perfil inválido. Permitidos: CELULA, REDE, MIDIA, PASTOR' })
  }),
  redeId: z.string().optional().nullable(),
  celulaId: z.string().optional().nullable(),
  identificadorCelula: z.string().optional().nullable(),
  nomeRede: z.string().optional().nullable()
});

export const atualizarUsuarioSchema = z.object({
  nome: z.string().min(3).optional(),
  email: z.string().email('E-mail inválido').optional(),
  senha: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres').optional(),
  perfil: z.enum(PERFIS_GERENCIAVEIS, {
    errorMap: () => ({ message: 'Perfil inválido. Permitidos: CELULA, REDE, MIDIA, PASTOR' })
  }).optional(),
  ativo: z.boolean().optional(),
  redeId: z.string().optional().nullable(),
  celulaId: z.string().optional().nullable(),
  identificadorCelula: z.string().optional().nullable(),
  nomeRede: z.string().optional().nullable()
});

export const filtrosUsuariosSchema = z.object({
  perfil: z.enum(PERFIS_GERENCIAVEIS).optional()
});

export type CriarUsuarioInput = z.infer<typeof criarUsuarioSchema>;
export type AtualizarUsuarioInput = z.infer<typeof atualizarUsuarioSchema>;

