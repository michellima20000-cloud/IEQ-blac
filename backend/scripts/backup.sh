#!/bin/sh
set -e

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Iniciando rotina de backup do PostgreSQL..."

BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
DUMP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.sql"
ENC_FILE="${DUMP_FILE}.enc"

mkdir -p "${BACKUP_DIR}"

# 1. Realiza o dump do banco de dados
echo "Gerando dump da base de dados..."
pg_dump "${DATABASE_URL}" > "${DUMP_FILE}"

# 2. Criptografa o dump com AES-256-CBC
if [ -n "${BACKUP_ENCRYPTION_KEY}" ]; then
  echo "Criptografando com AES-256-CBC..."
  openssl enc -aes-256-cbc -pbkdf2 -salt \
    -in "${DUMP_FILE}" \
    -out "${ENC_FILE}" \
    -k "${BACKUP_ENCRYPTION_KEY}"
  rm -f "${DUMP_FILE}"
  UPLOAD_FILE="${ENC_FILE}"
else
  echo "Aviso: BACKUP_ENCRYPTION_KEY não configurada. Arquivo salvo sem criptografia."
  UPLOAD_FILE="${DUMP_FILE}"
fi

# 3. Replicação para Nuvem S3 (Cloudflare R2 / Backblaze B2) se configurada
if [ -n "${CLOUD_S3_ENDPOINT}" ] && [ -n "${CLOUD_S3_BUCKET}" ] && [ -n "${CLOUD_S3_ACCESS_KEY}" ]; then
  echo "Configurando rclone para nuvem S3 compatível..."
  rclone config create s3-remote s3 \
    provider Other \
    endpoint "${CLOUD_S3_ENDPOINT}" \
    access_key_id "${CLOUD_S3_ACCESS_KEY}" \
    secret_access_key "${CLOUD_S3_SECRET_KEY}" \
    acl private > /dev/null 2>&1

  echo "Enviando arquivo para nuvem: ${CLOUD_S3_BUCKET}/backups/..."
  rclone copy "${UPLOAD_FILE}" "s3-remote:${CLOUD_S3_BUCKET}/backups/" || echo "Alerta: Falha ao enviar para a nuvem. Tentará no próximo ciclo."
fi

# 4. Limpeza local dos backups mais antigos que a retenção (padrão 7 dias)
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-7}
echo "Expurgando backups locais com mais de ${RETENTION_DAYS} dias..."
find "${BACKUP_DIR}" -name "backup_*.sql*" -mtime "+${RETENTION_DAYS}" -delete

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Backup concluído com sucesso!"

