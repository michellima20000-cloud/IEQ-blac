import { z } from 'zod';

export const criarMembroSchema = z.object({
  nome: z.string().min(3, 'O nome deve ter no mínimo 3 caracteres'),
  telefone: z.string().optional().nullable(),
  dataNascimento: z.string().optional().nullable()
});

export const atualizarMembroSchema = z.object({
  nome: z.string().min(3).optional(),
  telefone: z.string().optional().nullable(),
  dataNascimento: z.string().optional().nullable(),
  ativo: z.boolean().optional()
});

export const criarVisitanteSchema = z.object({
  nome: z.string().min(3, 'O nome deve ter no mínimo 3 caracteres'),
  telefone: z.string().optional().nullable(),
  dataPrimeiraVisita: z.string().optional()
});

export const criarRelatorioSchema = z.object({
  data: z.string().or(z.date()),
  presentes: z.number().int().min(0, 'Quantidade de presentes não pode ser negativa'),
  visitantes: z.number().int().min(0, 'Quantidade de visitantes não pode ser negativa'),
  observacoes: z.string().optional().nullable(),
  fotoUrl: z.string().optional().nullable()
});

export const atualizarRelatorioSchema = z.object({
  data: z.string().or(z.date()).optional(),
  presentes: z.number().int().min(0).optional(),
  visitantes: z.number().int().min(0).optional(),
  observacoes: z.string().optional().nullable(),
  fotoUrl: z.string().optional().nullable(),
  manterFoto: z.boolean().optional()
});

export const filtroDashboardPastorSchema = z.object({
  redeId: z.string().optional(),
  dataInicio: z.string().optional(),
  dataFim: z.string().optional()
});

export type CriarMembroInput = z.infer<typeof criarMembroSchema>;
export type AtualizarMembroInput = z.infer<typeof atualizarMembroSchema>;
export type CriarVisitanteInput = z.infer<typeof criarVisitanteSchema>;
export type CriarRelatorioInput = z.infer<typeof criarRelatorioSchema>;
export type AtualizarRelatorioInput = z.infer<typeof atualizarRelatorioSchema>;
export type FiltroDashboardPastorInput = z.infer<typeof filtroDashboardPastorSchema>;
