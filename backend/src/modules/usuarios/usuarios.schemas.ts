import { z } from '../../config/zodFallback.ts';

export const criarUsuarioSchema = z.object({
  nome: z.string().min(3, 'O nome deve ter no mínimo 3 caracteres'),
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres'),
  perfil: z.enum(['CELULA', 'REDE', 'MIDIA', 'ADM'], {
    errorMap: () => ({ message: 'Perfil inválido. Permitidos: CELULA, REDE, MIDIA, ADM' })
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
  perfil: z.enum(['CELULA', 'REDE', 'MIDIA', 'PASTOR', 'ADM'], {
    errorMap: () => ({ message: 'Perfil inválido. Permitidos: CELULA, REDE, MIDIA, PASTOR, ADM' })
  }).optional(),
  ativo: z.boolean().optional(),
  redeId: z.string().optional().nullable(),
  celulaId: z.string().optional().nullable(),
  identificadorCelula: z.string().optional().nullable(),
  nomeRede: z.string().optional().nullable()
});

export type CriarUsuarioInput = z.infer<typeof criarUsuarioSchema>;
export type AtualizarUsuarioInput = z.infer<typeof atualizarUsuarioSchema>;

