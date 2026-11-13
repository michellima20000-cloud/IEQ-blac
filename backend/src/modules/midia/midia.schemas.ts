import { z } from '../../config/zodFallback.ts';

const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/;

export const criarMidiaSchema = z.object({
  tipo: z.enum(['BANNER', 'FOTO', 'AVISO', 'VIDEO'], {
    errorMap: () => ({ message: 'Tipo inválido. Permitidos: BANNER, FOTO, AVISO, VIDEO' })
  }),
  titulo: z.string().min(3, 'O título deve ter no mínimo 3 caracteres'),
  descricao: z.string().optional().nullable(),
  arquivoUrl: z.string().optional().nullable(),
  videoUrl: z.string().optional().nullable(),
  // Sinaliza que veio um arquivo no upload (vídeo gravado em bytes no banco).
  temArquivo: z.boolean().optional(),
  tamanhoArquivoBytes: z.number().max(50 * 1024 * 1024, 'O limite para upload de vídeo é de 50 MB').optional(),
  precisaAprovacao: z.boolean().default(false)
}).refine((data) => {
  if (data.tipo === 'VIDEO') {
    if (!data.arquivoUrl && !data.videoUrl && !data.temArquivo) {
      return false;
    }
    if (data.videoUrl && !youtubeRegex.test(data.videoUrl)) {
      return false;
    }
  }
  return true;
}, {
  message: 'Vídeo requer um arquivo de até 50 MB OU um link de vídeo válido do YouTube.',
  path: ['videoUrl']
});

export const atualizarMidiaSchema = z.object({
  titulo: z.string().min(3).optional(),
  descricao: z.string().optional().nullable(),
  arquivoUrl: z.string().optional().nullable(),
  videoUrl: z.string().optional().nullable(),
  reenviarAprovacao: z.boolean().optional()
});

export const devolverMidiaSchema = z.object({
  comentarioPastor: z.string().min(5, 'O comentário do pastor com o motivo da devolução é obrigatório')
});

export const criarEventoSchema = z.object({
  titulo: z.string().min(3, 'Título do evento é obrigatório'),
  descricao: z.string().optional().nullable(),
  dataInicio: z.string().or(z.date()),
  dataFim: z.string().or(z.date()).optional(),
  tipo: z.enum(['CULTO', 'CONFERENCIA', 'REUNIAO', 'DATA_ESPECIAL', 'OUTRO'], {
    errorMap: () => ({ message: 'Tipo de evento inválido' })
  }).optional().default('OUTRO'),
  local: z.string().optional().nullable()
});

export const atualizarEventoSchema = z.object({
  titulo: z.string().min(3).optional(),
  descricao: z.string().optional().nullable(),
  dataInicio: z.string().or(z.date()).optional(),
  dataFim: z.string().or(z.date()).optional(),
  tipo: z.enum(['CULTO', 'CONFERENCIA', 'REUNIAO', 'DATA_ESPECIAL', 'OUTRO'], {
    errorMap: () => ({ message: 'Tipo de evento inválido' })
  }).optional(),
  local: z.string().optional().nullable()
});

export const personalizacaoVisualSchema = z.object({
  corPrimaria: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Cor primária deve ser hexadecimal').optional(),
  corSecundaria: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Cor secundária deve ser hexadecimal').optional(),
  corFundo: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Cor de fundo deve ser hexadecimal').optional(),
  logoUrl: z.string().url('URL da logo inválida').optional().nullable(),
  layoutDivulgacao: z.enum(['GRID', 'CARROSSEL', 'LISTA']).optional()
});

export const retencaoFotosSchema = z.object({
  prazoRetencaoFotosDias: z.number()
    .min(1, 'O prazo mínimo é de 1 dia')
    .max(365, 'O prazo máximo é de 365 dias')
});

export type CriarMidiaInput = z.infer<typeof criarMidiaSchema>;
export type AtualizarMidiaInput = z.infer<typeof atualizarMidiaSchema>;
export type DevolverMidiaInput = z.infer<typeof devolverMidiaSchema>;
export type CriarEventoInput = z.infer<typeof criarEventoSchema>;
export type AtualizarEventoInput = z.infer<typeof atualizarEventoSchema>;
export type PersonalizacaoVisualInput = z.infer<typeof personalizacaoVisualSchema>;
