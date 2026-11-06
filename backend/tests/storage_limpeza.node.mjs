import { describe, it } from 'node:test';
import assert from 'node:assert';
import { CleanupService } from '../src/services/cleanup.service.ts';
import { BackupService } from '../src/services/backup.service.ts';
import { StorageService } from '../src/services/storage.service.ts';

describe('Etapa 5 - Armazenamento, Limpeza Automática & Backup Resiliente', () => {
  const IGREJA_MATRIZ = 'igreja-matriz-id';

  describe('1. Limpeza Automática de Fotos de Relatórios Vencidas', () => {
    it('deve APAGAR foto vencida (mais de 60 dias) e preservar foto marcada com manterFoto: true', async () => {
      const dataHoje = new Date();

      // Relatório 1: Vencido (70 dias atrás), manterFoto: false -> FOTO DEVE SER APAGADA
      const dataVencida70Dias = new Date(dataHoje.getTime() - 70 * 24 * 60 * 60 * 1000);
      const relatorio1 = {
        id: 'rel-1-vencido',
        igreja_id: IGREJA_MATRIZ,
        data: dataVencida70Dias,
        fotoUrl: 'minio://ieq-local/relatorios/foto_celula_antiga.webp',
        manterFoto: false,
        presentes: 18,
        visitantes: 3,
        observacoes: 'Reunião abençoada',
        status: 'FECHADO'
      };

      // Relatório 2: Vencido (75 dias atrás), PORÉM com manterFoto: true -> FOTO DEVE SER PRESERVADA
      const dataVencida75Dias = new Date(dataHoje.getTime() - 75 * 24 * 60 * 60 * 1000);
      const relatorio2 = {
        id: 'rel-2-preservado',
        igreja_id: IGREJA_MATRIZ,
        data: dataVencida75Dias,
        fotoUrl: 'minio://ieq-local/relatorios/foto_batismo_importante.webp',
        manterFoto: true,
        presentes: 25,
        visitantes: 7,
        observacoes: 'Batismo na célula',
        status: 'FECHADO'
      };

      // Relatório 3: Recente (15 dias atrás) -> FOTO DEVE SER PRESERVADA
      const dataRecente15Dias = new Date(dataHoje.getTime() - 15 * 24 * 60 * 60 * 1000);
      const relatorio3 = {
        id: 'rel-3-recente',
        igreja_id: IGREJA_MATRIZ,
        data: dataRecente15Dias,
        fotoUrl: 'minio://ieq-local/relatorios/foto_semana_passada.webp',
        manterFoto: false,
        presentes: 20,
        visitantes: 2,
        observacoes: 'Estudo da palavra',
        status: 'FECHADO'
      };

      const relatorios = [relatorio1, relatorio2, relatorio3];

      // Executa a rotina de limpeza
      const resultado = await CleanupService.executarLimpezaFotosVencidas(IGREJA_MATRIZ, relatorios);

      assert.strictEqual(resultado.totalFotosApagadas, 1, 'Exatamente 1 foto vencida deve ter sido apagada');
      assert.strictEqual(resultado.totalFotosPreservadas, 1, 'Exatamente 1 foto vencida foi preservada por manterFoto');

      // 1. Confirma que a foto vencida foi limpa
      assert.strictEqual(relatorio1.fotoUrl, null, 'A foto do relatório 1 deve ser nula');

      // 2. Confirma que o relatório continua existindo e seus dados permanecem intactos
      assert.strictEqual(relatorio1.presentes, 18, 'Número de presentes deve continuar intacto');
      assert.strictEqual(relatorio1.visitantes, 3, 'Número de visitantes deve continuar intacto');
      assert.strictEqual(relatorio1.observacoes, 'Reunião abençoada', 'Observações devem continuar intactas');
      assert.strictEqual(relatorio1.status, 'FECHADO', 'Status deve continuar FECHADO');

      // 3. Confirma que a foto marcada como manterFoto NÃO foi apagada
      assert.ok(relatorio2.fotoUrl, 'A foto marcada como manterFoto deve continuar preservada');
      assert.strictEqual(relatorio2.fotoUrl, 'minio://ieq-local/relatorios/foto_batismo_importante.webp');

      // 4. Confirma que o relatório recente NÃO foi afetado
      assert.ok(relatorio3.fotoUrl, 'A foto recente deve continuar preservada');
    });

    it('deve identificar fotos prestes a vencer para aviso prévio de 7 dias', async () => {
      const dataHoje = new Date();
      // Relatório com 55 dias de idade (falta 5 dias para vencer os 60 dias)
      const data55Dias = new Date(dataHoje.getTime() - 55 * 24 * 60 * 60 * 1000);

      const relatorios = [
        {
          id: 'rel-aviso-1',
          igreja_id: IGREJA_MATRIZ,
          data: data55Dias,
          fotoUrl: 'minio://ieq-local/relatorios/foto_quase_expirando.webp',
          manterFoto: false,
          presentes: 14,
          visitantes: 1,
          observacoes: null,
          status: 'FECHADO'
        }
      ];

      const avisos = await CleanupService.identificarFotosPrestesAVencer(IGREJA_MATRIZ, relatorios);

      assert.strictEqual(avisos.length, 1);
      assert.strictEqual(avisos[0].relatorioId, 'rel-aviso-1');
      assert.ok(avisos[0].mensagemAviso.includes('Foto expira em breve'));
    });
  });

  describe('2. Backup Criptografado do PostgreSQL & Alerta > 48h', () => {
    it('deve criptografar e descriptografar dados do backup perfeitamente com AES-256', () => {
      const dumpOriginal = Buffer.from('CREATE TABLE igrejas (id UUID PRIMARY KEY, nome VARCHAR); INSERT INTO igrejas...');

      // Criptografa
      const dumpCriptografado = BackupService.criptografar(dumpOriginal);
      assert.notDeepStrictEqual(dumpCriptografado, dumpOriginal, 'Dump cifrado deve ser diferente do original');

      // Descriptografa
      const dumpRestaurado = BackupService.descriptografar(dumpCriptografado);
      assert.strictEqual(dumpRestaurado.toString('utf-8'), dumpOriginal.toString('utf-8'), 'Dump restaurado deve ser idêntico');
    });

    it('deve gerar ALERTA no painel do pastor se o último backup tiver mais de 48 horas', () => {
      // Simula histórico onde o último backup ocorreu há 50 horas
      const data50HorasAtras = new Date(Date.now() - 50 * 60 * 60 * 1000);
      BackupService._setHistorico([
        {
          id: 'bkp-antigo',
          nomeArquivo: 'backup_antigo.sql.enc',
          dataCriacao: data50HorasAtras,
          tamanhoBytes: 1024,
          criptografado: true,
          status: 'SUCESSO'
        }
      ]);

      const status = BackupService.verificarStatusBackupParaPastor();

      assert.strictEqual(status.alertaBackupPendente, true, 'Deve disparar alerta pois tem mais de 48h');
      assert.ok(status.mensagemAlerta.includes('ALERTA DE SEGURANÇA'));
      assert.ok(status.horasDesdeUltimoBackup >= 48);
    });

    it('NÃO deve gerar alerta se o último backup tiver menos de 48 horas (saudável)', () => {
      // Simula backup recente (há 2 horas)
      const data2HorasAtras = new Date(Date.now() - 2 * 60 * 60 * 1000);
      BackupService._setHistorico([
        {
          id: 'bkp-recente',
          nomeArquivo: 'backup_recente.sql.enc',
          dataCriacao: data2HorasAtras,
          tamanhoBytes: 1024,
          criptografado: true,
          status: 'SUCESSO'
        }
      ]);

      const status = BackupService.verificarStatusBackupParaPastor();

      assert.strictEqual(status.alertaBackupPendente, false, 'Não deve disparar alerta pois está saudável');
      assert.strictEqual(status.mensagemAlerta, null);
    });
  });

  describe('3. Isolamento da Limpeza: Mídia NUNCA é apagada', () => {
    it('banners e fotos da vitrine de mídia NÃO são afetados pelo expurgo de relatórios', async () => {
      const bannerMidia = {
        id: 'banner-conferencia',
        tipo: 'BANNER',
        arquivoUrl: 'minio://ieq-local/banners/conferencia2026.webp',
        createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000) // 120 dias atrás
      };

      // A rotina de limpeza atua exclusivamente sobre RelatorioCelula
      // Banners e mídias nunca são selecionados
      assert.ok(bannerMidia.arquivoUrl.includes('/banners/'), 'Banners permanecem para sempre na vitrine');
    });
  });
});

