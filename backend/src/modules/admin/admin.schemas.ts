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
  perfil: z.string().optional()
});

export type CriarAdminUsuarioInput = z.infer<typeof criarAdminUsuarioSchema>;
export type FiltrosAdminUsuariosInput = z.infer<typeof filtrosAdminUsuariosSchema>;
