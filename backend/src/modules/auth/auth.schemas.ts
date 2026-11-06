import { z } from '../../config/zodFallback.ts';

export const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres'),
  slugIgreja: z.string().min(2, 'O identificador da igreja é obrigatório')
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10, 'Refresh token inválido')
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;

