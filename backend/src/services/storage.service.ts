import { STORAGE_CONFIG } from '../config/storage.ts';
import { signJwt } from '../config/cryptoUtils.ts';
import { ENV } from '../config/env.ts';

// Armazenamento em memória / mock para testes locais
const localStorageMock = new Map<string, { buffer: Buffer; mimeType: string; size: number }>();
const cloudStorageMock = new Map<string, { buffer: Buffer; mimeType: string; size: number }>();

export class StorageService {
  /**
   * Salva arquivo no armazenamento local (MinIO)
   */
  static async salvarLocal(key: string, buffer: Buffer, mimeType: string = 'application/octet-stream') {
    localStorageMock.set(key, { buffer, mimeType, size: buffer.length });
    return {
      key,
      url: `minio://${STORAGE_CONFIG.minio.bucket}/${key}`,
      size: buffer.length
    };
  }

  /**
   * Gera URL assinada com expiração para download seguro
   */
  static gerarUrlAssinada(key: string, expiracaoMinutos: number = 15): string {
    const token = signJwt({ key, tipo: 'DOWNLOAD_ASSINADO' }, ENV.JWT_SECRET, `${expiracaoMinutos}m`);
    return `/api/v1/storage/download/${key}?token=${token}`;
  }

  /**
   * Remove arquivo do MinIO local E da nuvem (Cloud S3)
   */
  static async excluir(key: string): Promise<{ localRemovido: boolean; nuvemRemovida: boolean }> {
    const localRemovido = localStorageMock.delete(key);
    const nuvemRemovida = cloudStorageMock.delete(key);

    return { localRemovido, nuvemRemovida };
  }

  /**
   * Calcula o espaço em disco utilizado em bytes
   */
  static async obterEspacoUtilizado(): Promise<number> {
    let total = 0;
    for (const item of localStorageMock.values()) {
      total += item.size;
    }
    return total;
  }

  /**
   * Acesso direto para testes de integridade
   */
  static _mockStorage() {
    return { localStorageMock, cloudStorageMock };
  }
}
