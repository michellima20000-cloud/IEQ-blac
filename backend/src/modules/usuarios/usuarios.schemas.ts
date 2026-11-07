import { z } from '../../config/zodFallback.ts';

export const criarUsuarioSchema = z.object({
  nome: z.string().min(3, 'O nome deve ter no mínimo 3 caracteres'),
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres'),
  perfil: z.enum(['CELULA', 'REDE', 'MIDIA'], {
    errorMap: () => ({ message: 'Perfil inválido. Permitidos: CELULA, REDE, MIDIA' })
  }),
  redeId: z.string().optional().nullable(),
  celulaId: z.string().optional().nullable()
});

export const atualizarUsuarioSchema = z.object({
  nome: z.string().min(3).optional(),
  ativo: z.boolean().optional(),
  redeId: z.string().uuid().optional().nullable(),
  celulaId: z.string().uuid().optional().nullable()
});

export type CriarUsuarioInput = z.infer<typeof criarUsuarioSchema>;
export type AtualizarUsuarioInput = z.infer<typeof atualizarUsuarioSchema>;

