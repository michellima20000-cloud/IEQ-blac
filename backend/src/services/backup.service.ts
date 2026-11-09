import crypto from 'node:crypto';
import { STORAGE_CONFIG } from '../config/storage.ts';

export interface BackupRegistro {
  id: string;
  nomeArquivo: string;
  dataCriacao: Date;
  tamanhoBytes: number;
  criptografado: boolean;
  status: 'SUCESSO' | 'FALHA';
}

// Horas de retenção antes de alertar o pastor (configurável via ambiente)
const TEMPO_ALERTA_HORAS = STORAGE_CONFIG.backup.alertaAposHoras || 48;

// Histórico de backups em memória para controle
let historicoBackups: BackupRegistro[] = [];

export class BackupService {
  /**
   * Criptografa dados com AES-256-CBC
   */
  static criptografar(dadosBuffer: Buffer, chaveSegredo: string = STORAGE_CONFIG.backup.encryptionKey): Buffer {
    // Garante chave de 32 bytes via sha256
    const key = crypto.createHash('sha256').update(chaveSegredo).digest();
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([cipher.update(dadosBuffer), cipher.final()]);

    // Retorna IV (16 bytes) concatenado com o texto cifrado
    return Buffer.concat([iv, encrypted]);
  }

  /**
   * Descriptografa dados com AES-256-CBC
   */
  static descriptografar(dadosCifrados: Buffer, chaveSegredo: string = STORAGE_CONFIG.backup.encryptionKey): Buffer {
    const key = crypto.createHash('sha256').update(chaveSegredo).digest();
    const iv = dadosCifrados.subarray(0, 16);
    const ciphertext = dadosCifrados.subarray(16);

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }

  /**
   * Executa rotina diária de backup, criptografia e expurgo de retenção (7 dias)
   */
  static async executarBackupDiario(mockDadosPgDump: Buffer = Buffer.from('DUMP_SQL_POSTGRESQL_IEQ_2026')): Promise<BackupRegistro> {
    const dadosCriptografados = this.criptografar(mockDadosPgDump);
    const dataCriacao = new Date();
    const nomeArquivo = `backup_ieq_${dataCriacao.toISOString().replace(/[:.]/g, '-')}.sql.enc`;

    const novoBackup: BackupRegistro = {
      id: `bkp-${Date.now()}`,
      nomeArquivo,
      dataCriacao,
      tamanhoBytes: dadosCriptografados.length,
      criptografado: true,
      status: 'SUCESSO'
    };

    historicoBackups.push(novoBackup);

    // Retenção: Mantém apenas os últimos N dias (configurável)
    const limiteRetencao = new Date(Date.now() - STORAGE_CONFIG.backup.retencaoDias * 24 * 60 * 60 * 1000);
    historicoBackups = historicoBackups.filter((b) => b.dataCriacao >= limiteRetencao);

    return novoBackup;
  }

  /**
   * Verifica o status de saúde do backup para o Painel do Pastor.
   * Alerta se o último backup tiver mais de TEMPO_ALERTA_HORAS (padrão: 48h).
   */
  static verificarStatusBackupParaPastor(): {
    alertaBackupPendente: boolean;
    mensagemAlerta: string | null;
    ultimoBackup: BackupRegistro | null;
    horasDesdeUltimoBackup: number;
    totalBackupsRetidos: number;
  } {
    const backupsOrdenados = [...historicoBackups].sort(
      (a, b) => b.dataCriacao.getTime() - a.dataCriacao.getTime()
    );

    const ultimoBackup = backupsOrdenados[0] || null;

    if (!ultimoBackup) {
      return {
        alertaBackupPendente: true,
        mensagemAlerta: `ATENÇÃO: Nenhum backup do sistema foi localizado nas últimas ${TEMPO_ALERTA_HORAS} horas.`,
        ultimoBackup: null,
        horasDesdeUltimoBackup: 999,
        totalBackupsRetidos: 0
      };
    }

    const agora = Date.now();
    const diffMs = agora - ultimoBackup.dataCriacao.getTime();
    const horasDesdeUltimoBackup = Number((diffMs / (1000 * 60 * 60)).toFixed(1));

    const alertaBackupPendente = horasDesdeUltimoBackup > TEMPO_ALERTA_HORAS;
    const mensagemAlerta = alertaBackupPendente
      ? `ALERTA DE SEGURANÇA: O último backup tem mais de ${TEMPO_ALERTA_HORAS}h (${horasDesdeUltimoBackup}h atrás). Verifique a rotina de replicação.`
      : null;

    return {
      alertaBackupPendente,
      mensagemAlerta,
      ultimoBackup,
      horasDesdeUltimoBackup,
      totalBackupsRetidos: historicoBackups.length
    };
  }

  /**
   * Injeta registro de backup para testes
   */
  static _setHistorico(registros: BackupRegistro[]) {
    historicoBackups = registros;
  }
}

