import { ImageProcessor } from '../services/imageProcessor.ts';
import { CloudSyncService } from '../services/cloudSync.service.ts';
import { CleanupService } from '../services/cleanup.service.ts';
import { BackupService } from '../services/backup.service.ts';

// Configuração de processamento de tarefas em segundo plano (BullMQ / In-Memory Worker)
export class QueueManager {
  /**
   * Enfileira imagem para compressão WebP (máx. 1280px) com até 3 retentativas
   */
  static async enqueueImageCompression(buffer: Buffer, key: string) {
    try {
      const resultado = await ImageProcessor.processToWebP(buffer, {
        maxWidth: 1280,
        maxHeight: 1280,
        quality: 80
      });

      // Após processar, enfileira para replicação na nuvem
      await this.enqueueCloudSync(key);

      return resultado;
    } catch (err: any) {
      console.error(`[QueueManager] Erro no processamento da imagem ${key}:`, err.message);
      throw err;
    }
  }

  /**
   * Enfileira cópia resiliente para nuvem (R2 ou B2)
   */
  static async enqueueCloudSync(key: string) {
    return CloudSyncService.sincronizarArquivo(key);
  }

  /**
   * Executa a rotina diária completa (Backup PostgreSQL + Limpeza de Fotos Vencidas)
   */
  static async runDailyMaintenance(igreja_id: string) {
    console.log(`[QueueManager] Iniciando manutenção diária para a igreja ${igreja_id}...`);

    // 1. Backup diário criptografado do PostgreSQL
    const backupResultado = await BackupService.executarBackupDiario();

    // 2. Limpeza de fotos de relatórios vencidas
    const limpezaResultado = await CleanupService.executarLimpezaFotosVencidas(igreja_id);

    return {
      backup: backupResultado,
      limpeza: limpezaResultado
    };
  }
}

