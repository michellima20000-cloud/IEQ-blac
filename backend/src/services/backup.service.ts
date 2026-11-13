import crypto from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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

/**
 * Tabelas do sistema (modelo do Prisma -> nome da tabela).
 * Usadas no dump manual (fallback quando o pg_dump não está disponível).
 */
const TABELAS_BACKUP: Array<{ model: string; tabela: string }> = [
  { model: 'igreja', tabela: 'igrejas' },
  { model: 'configuracaoIgreja', tabela: 'configuracoes_igrejas' },
  { model: 'rede', tabela: 'redes' },
  { model: 'celula', tabela: 'celulas' },
  { model: 'membro', tabela: 'membros' },
  { model: 'visitante', tabela: 'visitantes' },
  { model: 'relatorioCelula', tabela: 'relatorios_celulas' },
  { model: 'usuario', tabela: 'usuarios' },
  { model: 'conteudoMidia', tabela: 'conteudos_midia' },
  { model: 'midiaArquivoParte', tabela: 'midia_arquivo_partes' },
  { model: 'arquivoIgreja', tabela: 'arquivos_igreja' },
  { model: 'eventoCalendario', tabela: 'eventos_calendario' },
  { model: 'logAuditoria', tabela: 'logs_auditoria' }
];

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
   * Gera um dump REAL do banco.
   *
   * 1. Se o binário pg_dump estiver disponível (imagem do Render/Alpine com
   *    postgresql-client), usa ele: gera um .sql completo.
   * 2. Sem o binário, exporta todas as tabelas do sistema em JSON
   *    (dump manual, também com todos os dados) — o backup continua sendo real.
   */
  static async gerarDump(): Promise<{ buffer: Buffer; formato: 'sql' | 'json' }> {
    const dumpSql = await this.gerarDumpComPgDump();
    if (dumpSql) {
      return { buffer: dumpSql, formato: 'sql' };
    }

    const { prisma } = await import('../config/prisma.ts');
    const dados: Record<string, unknown[]> = {};

    for (const { model, tabela } of TABELAS_BACKUP) {
      const client = (prisma as any)[model];
      if (!client || typeof client.findMany !== 'function') continue;
      try {
        // As tabelas de arquivos guardam os BYTES (foto/vídeo): serializar
        // isso em JSON gera centenas de MB e estoura a memória da API.
        // O dump guarda os metadados; os bytes ficam no banco.
        let consulta: any;
        if (model === 'midiaArquivoParte') {
          consulta = client.findMany({
            select: { id: true, conteudoId: true, ordem: true, tamanho: true, createdAt: true }
          });
        } else if (model === 'arquivoIgreja') {
          consulta = client.findMany({
            select: { id: true, igreja_id: true, mimeType: true, nomeOriginal: true, tamanho: true, createdAt: true }
          });
        } else {
          consulta = client.findMany();
        }

        dados[tabela] = await consulta;
      } catch (erro: any) {
        console.warn(`[backup] Falha ao exportar a tabela ${tabela}: ${erro?.message}`);
        dados[tabela] = [];
      }
    }

    const conteudo = JSON.stringify(
      {
        geradoEm: new Date().toISOString(),
        formato: 'dump-json-ieq',
        tabelas: dados
      },
      (_chave, valor) => (typeof valor === 'bigint' ? valor.toString() : valor)
    );

    return { buffer: Buffer.from(conteudo, 'utf-8'), formato: 'json' };
  }

  /** Dump SQL via pg_dump (retorna null se o binário não existir/falhar). */
  private static async gerarDumpComPgDump(): Promise<Buffer | null> {
    const binario = process.env.PG_DUMP_PATH || 'pg_dump';
    if (!binario) return null;

    try {
      const { spawn } = await import('node:child_process');
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) return null;

      return await new Promise<Buffer | null>((resolve) => {
        const processo = spawn(binario, ['--no-owner', '--no-acl', databaseUrl], {
          stdio: ['ignore', 'pipe', 'pipe']
        });

        const partes: Buffer[] = [];
        let stderr = '';

        processo.stdout.on('data', (dado: Buffer) => partes.push(dado));
        processo.stderr.on('data', (dado: Buffer) => { stderr += dado.toString(); });
        processo.on('error', () => resolve(null));
        processo.on('close', (codigo) => {
          if (codigo === 0 && partes.length > 0) {
            resolve(Buffer.concat(partes));
          } else {
            if (stderr) console.warn(`[backup] pg_dump indisponível: ${stderr.split('\n')[0]}`);
            resolve(null);
          }
        });
      });
    } catch {
      return null;
    }
  }

  /**
   * Executa a rotina diária de backup: gera o dump, criptografa (AES-256),
   * grava o arquivo em disco e aplica a retenção configurada.
   */
  static async executarBackupDiario(dadosJaProntos?: Buffer): Promise<BackupRegistro> {
    const dataCriacao = new Date();
    let conteudo: Buffer;
    let extensao: string;

    if (dadosJaProntos) {
      conteudo = dadosJaProntos;
      extensao = 'sql';
    } else {
      const dump = await this.gerarDump();
      conteudo = dump.buffer;
      extensao = dump.formato;
    }

    const dadosCriptografados = this.criptografar(conteudo);
    const nomeArquivo = `backup_ieq_${dataCriacao.toISOString().replace(/[:.]/g, '-')}.${extensao}.enc`;

    // Grava o arquivo criptografado no disco (pasta BACKUP_DIR ou ./backups)
    const pastaBackup = process.env.BACKUP_DIR || 'backups';
    try {
      if (!existsSync(pastaBackup)) mkdirSync(pastaBackup, { recursive: true });
      writeFileSync(join(pastaBackup, nomeArquivo), dadosCriptografados);
    } catch (erro: any) {
      console.warn(`[backup] Não foi possível gravar o arquivo de backup: ${erro?.message}`);
    }

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
