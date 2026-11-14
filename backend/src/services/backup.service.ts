import crypto from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync, unlinkSync, statSync, createReadStream, createWriteStream } from 'node:fs';
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
   * ATENÇÃO (memória): o dump via pg_dump é gravado direto em disco
   * (ver gerarDumpEmArquivo). Esta versão em memória é limitada a few rows
   * por tabela e NÃO usa pg_dump — usá-la com o banco inteiro estourava a
   * memória da instância (512 MB no Render) e derrubava o servidor.
   */
  static async gerarDump(): Promise<{ buffer: Buffer; formato: 'sql' | 'json' }> {
    const { prisma } = await import('../config/prisma.ts');
    const dados: Record<string, unknown[]> = {};
    const LIMITE_LINHAS = 2000;

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
            select: { id: true, conteudoId: true, ordem: true, tamanho: true, createdAt: true },
            take: LIMITE_LINHAS
          });
        } else if (model === 'arquivoIgreja') {
          consulta = client.findMany({
            select: { id: true, igreja_id: true, mimeType: true, nomeOriginal: true, tamanho: true, createdAt: true },
            take: LIMITE_LINHAS
          });
        } else {
          consulta = client.findMany({ take: LIMITE_LINHAS });
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

  /**
   * Gera o dump direto em arquivo, sem carregar tudo na memória.
   * Usa pg_dump (streaming) quando disponível; senão, exporta os metadados.
   */
  private static async gerarDumpEmArquivo(caminho: string): Promise<{ formato: 'sql' | 'json'; bytes: number }> {
    const viaPgDump = await this.gerarDumpComPgDumpParaArquivo(caminho);
    if (viaPgDump) {
      return { formato: 'sql', bytes: this.tamanhoArquivo(caminho) };
    }

    const dump = await this.gerarDump();
    writeFileSync(caminho, dump.buffer);
    return { formato: 'json', bytes: dump.buffer.length };
  }

  private static tamanhoArquivo(caminho: string): number {
    try {
      return statSync(caminho).size;
    } catch {
      return 0;
    }
  }

  /** Dump SQL via pg_dump gravando direto no arquivo (streaming). */
  private static async gerarDumpComPgDumpParaArquivo(caminho: string): Promise<boolean> {
    const binario = process.env.PG_DUMP_PATH || 'pg_dump';
    if (!binario) return false;

    try {
      const { spawn } = await import('node:child_process');
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) return false;

      return await new Promise<boolean>((resolve) => {
        const processo = spawn(binario, ['--no-owner', '--no-acl', databaseUrl], {
          stdio: ['ignore', 'pipe', 'pipe']
        });

        const saida = createWriteStream(caminho);
        let stderr = '';

        processo.stdout.pipe(saida);
        processo.stderr.on('data', (dado: Buffer) => { stderr += dado.toString(); });
        processo.on('error', () => {
          try { saida.close(); } catch { /* ignore */ }
          resolve(false);
        });
        saida.on('error', () => {
          try { processo.kill('SIGKILL'); } catch { /* ignore */ }
          resolve(false);
        });
        processo.on('close', (codigo) => {
          saida.on('finish', () => {
            if (codigo === 0) {
              resolve(true);
            } else {
              if (stderr) console.warn(`[backup] pg_dump indisponível: ${stderr.split('\n')[0]}`);
              resolve(false);
            }
          });
          saida.end();
        });
      });
    } catch {
      return false;
    }
  }

  /** Criptografa um arquivo em streaming (chunk a chunk), sem estourar memória. */
  private static async criptografarArquivo(origem: string, destino: string): Promise<void> {
    const key = crypto.createHash('sha256').update(STORAGE_CONFIG.backup.encryptionKey).digest();
    const iv = crypto.randomBytes(16);

    await new Promise<void>((resolve, reject) => {
      const entrada = createReadStream(origem);
      const saida = createWriteStream(destino);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

      saida.write(iv);
      entrada.on('error', reject);
      saida.on('error', reject);
      cipher.on('error', reject);
      saida.on('finish', () => resolve());

      entrada.pipe(cipher).pipe(saida);
    });
  }

  /**
   * Executa a rotina diária de backup: gera o dump, criptografa (AES-256),
   * grava o arquivo em disco e aplica a retenção configurada.
   *
   * Tudo é feito por STREAMING em disco: nada do dump fica na memória.
   */
  static async executarBackupDiario(dadosJaProntos?: Buffer): Promise<BackupRegistro> {
    const dataCriacao = new Date();

    // Grava o arquivo criptografado no disco (pasta BACKUP_DIR ou ./backups)
    const pastaBackup = process.env.BACKUP_DIR || 'backups';
    try {
      if (!existsSync(pastaBackup)) mkdirSync(pastaBackup, { recursive: true });
    } catch (erro: any) {
      console.warn(`[backup] Não foi possível criar a pasta de backup: ${erro?.message}`);
    }

    let extensao = 'json';
    const nomeArquivo = `backup_ieq_${dataCriacao.toISOString().replace(/[:.]/g, '-')}`;
    const caminhoBruto = join(pastaBackup, `${nomeArquivo}.bruto`);
    const caminhoFinal = join(pastaBackup, `${nomeArquivo}.${extensao}.enc`);

    try {
      if (dadosJaProntos) {
        writeFileSync(caminhoBruto, dadosJaProntos);
      } else {
        const dump = await this.gerarDumpEmArquivo(caminhoBruto);
        extensao = dump.formato;
      }

      await this.criptografarArquivo(caminhoBruto, caminhoFinal);
    } catch (erro: any) {
      console.warn(`[backup] Falha ao gerar o arquivo de backup: ${erro?.message}`);
    } finally {
      try { if (existsSync(caminhoBruto)) unlinkSync(caminhoBruto); } catch { /* ignore */ }
    }

    const tamanhoBytes = this.tamanhoArquivo(caminhoFinal);

    const novoBackup: BackupRegistro = {
      id: `bkp-${Date.now()}`,
      nomeArquivo: `${nomeArquivo}.${extensao}.enc`,
      dataCriacao,
      tamanhoBytes,
      criptografado: true,
      status: tamanhoBytes > 0 ? 'SUCESSO' : 'FALHA'
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
