export interface ProcessImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

/**
 * Detecta o tipo real do arquivo pelos bytes do buffer.
 * Usado no fallback (sem sharp) para NÃO rotular um JPEG como "image/webp"
 * (o navegador deixaria de exibir a imagem na vitrine).
 */
export function detectarMimeType(buffer: Buffer): string {
  if (!buffer || buffer.length === 0) return 'application/octet-stream';

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    )
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buffer.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (buffer.length >= 6 && buffer.subarray(0, 6).toString('latin1').startsWith('GIF8')) {
    return 'image/gif';
  }
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('latin1') === 'ftyp') {
    return 'video/mp4';
  }
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('latin1') === 'moov') {
    return 'video/mp4';
  }
  return 'application/octet-stream';
}

export class ImageProcessor {
  /**
   * Converte e redimensiona imagem para WebP (máx 1280px).
   * Sem a biblioteca sharp (instalada apenas no Docker), devolve o arquivo
   * original preservando o MIME real.
   */
  static async processToWebP(
    inputBuffer: Buffer,
    options: ProcessImageOptions = { maxWidth: 1280, maxHeight: 1280, quality: 80 }
  ): Promise<{ buffer: Buffer; mimeType: string; format: string }> {
    try {
      // Se sharp estiver instalado (em produção / docker), utiliza sharp
      const sharp = (await import('sharp')).default;
      const processed = await sharp(inputBuffer)
        .resize(options.maxWidth || 1280, options.maxHeight || 1280, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .webp({ quality: options.quality || 80 })
        .toBuffer();

      return {
        buffer: processed,
        mimeType: 'image/webp',
        format: 'webp'
      };
    } catch {
      // Fallback gracioso: mantém os bytes originais com o MIME correto,
      // para o navegador exibir a imagem normalmente na vitrine.
      const mimeType = detectarMimeType(inputBuffer);
      return {
        buffer: inputBuffer,
        mimeType,
        format: mimeType.split('/')[1] || 'binario'
      };
    }
  }
}
