import { z } from '../../config/zodFallback.ts';

export const criarAdminUsuarioSchema = z.object({
  igrejaId: z.string().min(1, 'Informe a igreja do novo usuário'),
  nome: z.string().min(3, 'O nome deve ter no mínimo 3 caracteres'),
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres'),
  perfil: z.enum(['CELULA', 'REDE', 'MIDIA', 'PASTOR', 'ADM'], {
    errorMap: () => ({ message: 'Perfil inválido. Permitidos: CELULA, REDE, MIDIA, PASTOR, ADM' })
  }),
  redeId: z.string().optional().nullable(),
  celulaId: z.string().optional().nullable(),
  identificadorCelula: z.string().optional().nullable(),
  nomeRede: z.string().optional().nullable()
});

export const filtrosAdminUsuariosSchema = z.object({
  igrejaId: z.string().optional(),
  perfil: z.enum(['CELULA', 'REDE', 'MIDIA', 'PASTOR', 'ADM']).optional()
});

/**
 * Atualização de usuário feita pelo ADM: aqui o perfil ADM é permitido,
 * porque quem chama já é superusuário.
 */
export const atualizarAdminUsuarioSchema = z.object({
  nome: z.string().min(3).optional(),
  email: z.string().email('E-mail inválido').optional(),
  senha: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres').optional(),
  perfil: z.enum(['CELULA', 'REDE', 'MIDIA', 'PASTOR', 'ADM'], {
    errorMap: () => ({ message: 'Perfil inválido. Permitidos: CELULA, REDE, MIDIA, PASTOR, ADM' })
  }).optional(),
  ativo: z.boolean().optional(),
  redeId: z.string().optional().nullable(),
  celulaId: z.string().optional().nullable(),
  identificadorCelula: z.string().optional().nullable(),
  nomeRede: z.string().optional().nullable()
});

export const criarIgrejaSchema = z.object({
  nome: z.string().min(3, 'O nome deve ter no mínimo 3 caracteres'),
  slug: z
    .string()
    .min(3, 'O slug deve ter no mínimo 3 caracteres')
    .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífen'),
  ativa: z.boolean().optional(),
});

export const atualizarIgrejaSchema = z.object({
  nome: z.string().min(3).optional(),
  slug: z
    .string()
    .min(3)
    .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífen')
    .optional(),
  ativa: z.boolean().optional(),
});

export type CriarAdminUsuarioInput = z.infer<typeof criarAdminUsuarioSchema>;
export type FiltrosAdminUsuariosInput = z.infer<typeof filtrosAdminUsuariosSchema>;
export type CriarIgrejaInput = z.infer<typeof criarIgrejaSchema>;
export type AtualizarIgrejaInput = z.infer<typeof atualizarIgrejaSchema>;
