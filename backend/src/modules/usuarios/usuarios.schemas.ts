import { z } from '../../config/zodFallback.ts';

export const criarUsuarioSchema = z.object({
  nome: z.string().min(3, 'O nome deve ter no mínimo 3 caracteres'),
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres'),
  perfil: z.enum(['CELULA', 'REDE', 'MIDIA'], {
    errorMap: () => ({ message: 'Perfil inválido. Permitidos: CELULA, REDE, MIDIA' })
  }),
  redeId: z.string().uuid('ID da rede inválido').optional().nullable(),
  celulaId: z.string().uuid('ID da célula inválido').optional().nullable()
}).refine((data) => {
  if (data.perfil === 'CELULA' && !data.celulaId) {
    return false;
  }
  return true;
}, {
  message: 'Líder de Célula requer vínculo com uma célula (celulaId)',
  path: ['celulaId']
}).refine((data) => {
  if (data.perfil === 'REDE' && !data.redeId) {
    return false;
  }
  return true;
}, {
  message: 'Líder de Rede requer vínculo com uma rede (redeId)',
  path: ['redeId']
});

export const atualizarUsuarioSchema = z.object({
  nome: z.string().min(3).optional(),
  ativo: z.boolean().optional(),
  redeId: z.string().uuid().optional().nullable(),
  celulaId: z.string().uuid().optional().nullable()
});

export type CriarUsuarioInput = z.infer<typeof criarUsuarioSchema>;
export type AtualizarUsuarioInput = z.infer<typeof atualizarUsuarioSchema>;

