import { ENV } from './env.ts';

export const STORAGE_CONFIG = {
  // MinIO Local (S3 compatível no Docker)
  minio: {
    endpoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: Number(process.env.MINIO_PORT) || 9000,
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
    bucket: process.env.MINIO_BUCKET || 'ieq-local'
  },

  // Nuvem Privada (Cloudflare R2 ou Backblaze B2)
  cloudS3: {
    endpoint: process.env.CLOUD_S3_ENDPOINT || 'https://r2.cloudflarestorage.com',
    bucket: process.env.CLOUD_S3_BUCKET || 'ieq-backup-privado',
    accessKey: process.env.CLOUD_S3_ACCESS_KEY || 'r2_access_key',
    secretKey: process.env.CLOUD_S3_SECRET_KEY || 'r2_secret_key',
    region: process.env.CLOUD_S3_REGION || 'auto'
  },

  // Criptografia de Backups (AES-256)
  backup: {
    encryptionKey: process.env.BACKUP_ENCRYPTION_KEY || 'ieq_backup_secret_key_32bytes!!',
    retencaoDias: 7
  }
};
