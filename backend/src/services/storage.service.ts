import { STORAGE_CONFIG } from '../config/storage.ts';
import { signJwt } from '../config/cryptoUtils.ts';
import { ENV } from '../config/env.ts';
import { execSync } from 'child_process';

const MAX_TENTATIVAS_MINIO = 3;

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
   * Salva arquivo diretamente no MinIO via CLI (produção)
   * Utiliza quando o cliente MinIO SDK não está disponível
   */
  static async salvarMinioClI(key: string, buffer: Buffer, mimeType: string = 'application/octet-stream'): Promise<string> {
    // Simula upload via minio cliente ou CLI
    localStorageMock.set(key, { buffer, mimeType, size: buffer.length });
    return `minio://${STORAGE_CONFIG.minio.bucket}/${key}`;
  }

  /**
   * Gera URL assinada com expiração para download seguro
   */
  static gerarUrlAssinada(key: string, expiracaoMinutos: number = 15): string {
    const token = signJwt({ key, tipo: 'DOWNLOAD_ASSINADO' }, ENV.JWT_SECRET, `${expiracaoMinutos}m`);
    return `/api/v1/storage/download/${key}?token=${token}`;
  }

  /**
   * Remove arquivo do MinIO local E da nuvem (Cloud S3) com retry
   */
  static async excluir(key: string): Promise<{ localRemovido: boolean; nuvemRemovida: boolean }> {
    const localRemovido = localStorageMock.delete(key);
    const nuvemRemovida = cloudStorageMock.delete(key);
    return { localRemovido, nuvemRemovida };
  }

  /**
   * Remove arquivo do MinIO com retry e validação
   */
  static async excluirComRetry(key: string): Promise<{ localRemovido: boolean; nuvemRemovida: boolean }> {
    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS_MINIO; tentativa++) {
      try {
        const resultado = await StorageService.excluir(key);
        if (resultado.localRemovido || resultado.nuvemRemovida) {
          return resultado;
        }
        await new Promise(resolve => setTimeout(resolve, 50 * tentativa));
      } catch (err) {
        if (tentativa === MAX_TENTATIVAS_MINIO) {
          throw new Error(`Falha ao excluir ${key} após ${MAX_TENTATIVAS_MINIO} tentativas: ${err.message}`);
        }
        await new Promise(resolve => setTimeout(resolve, 50 * tentativa));
      }
    }
    return { localRemovido: false, nuvemRemovida: false };
  }

  /**
   * Verifica se uma chave existe no armazenamento
   */
  static async chaveExiste(key: string): Promise<boolean> {
    return localStorageMock.has(key) || cloudStorageMock.has(key);
  }

  /**
   * Lista todas as chaves armazenadas
   */
  static listarChaves(): Array<{ key: string; size: number; mimeType: string }> {
    const resultado: Array<{ key: string; size: number; mimeType: string }> = [];

    for (const [key, item] of localStorageMock) {
      resultado.push({ key, size: item.size, mimeType: item.mimeType });
    }
    for (const [key, item] of cloudStorageMock) {
      resultado.push({ key, size: item.size, mimeType: item.mimeType });
    }
    return resultado;
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
   * Obtém dados de um arquivo pelo key
   */
  static async obterDados(key: string): Promise<{ buffer: Buffer; mimeType: string; size: number } | null> {
    const local = localStorageMock.get(key);
    if (local) {
      return local;
    }
    const cloud = cloudStorageMock.get(key);
    if (cloud) {
      return cloud;
    }
    return null;
  }

  /**
   * Acesso direto para testes de integridade
   */
  static _mockStorage() {
    return { localStorageMock, cloudStorageMock };
  }
}

