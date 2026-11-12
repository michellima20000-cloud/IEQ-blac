# ⛪ IEQ - Sistema de Gestão de Células, Mídia e Relatórios

Sistema completo e desacoplado para igrejas com suporte a multi-tenant, gestão de células e redes, fluxo de aprovação de mídia, armazenamento local em MinIO com replicação para S3 na nuvem (Cloudflare R2 / Backblaze B2) e PWA mobile-first em React + Vite.

---

## 🏗️ Arquitetura

- **Backend**: Node.js + Express + TypeScript, Prisma ORM, PostgreSQL, Redis + BullMQ.
- **Frontend**: React + Vite + Tailwind CSS + PWA (Mobile-first), consumindo exclusivamente a API REST.
- **Armazenamento**: MinIO local S3-compatível com URLs assinadas temporárias (15 min).
- **Processamento**: Conversão automática para WebP (máx. 1280px) em fila BullMQ.
- **Backup & Nuvem**: Cópia diária encriptada com AES-256 e sincronização rclone para R2/B2.

---

## ⚠️ AVISO IMPORTANTE SOBRE O RENDER (Plano Gratuito)

> **Atenção:** No plano gratuito do Render.com, os containers têm sistema de arquivos efêmero (não há volume persistente) e entram em modo sleep após inatividade. Por esse motivo, **o plano gratuito do Render serve EXCLUSIVAMENTE para demonstração e testes efêmeros**. Para produção com retenção de dados, fotos e backups, utilize um servidor VPS próprio (ex: Hetzner, DigitalOcean, Linode, AWS EC2, Oracle Cloud Free Tier) executando Docker e Docker Compose com volumes persistentes.

---

## 🚀 Como Rodar Localmente

### Pré-requisitos
- [Docker](https://docs.docker.com/get-docker/) e [Docker Compose](https://docs.docker.com/compose/) instalados.

### 1. Clonar o repositório
```bash
git clone https://github.com/michellima20000-cloud/IEQ-blac.git
cd IEQ-blac
```

### 2. Configurar o arquivo `.env`
Copie o modelo de variáveis de ambiente:
```bash
cp .env.example .env
```
Edite o arquivo `.env` gerando chaves secretas para `JWT_SECRET`, `JWT_REFRESH_SECRET` e `BACKUP_ENCRYPTION_KEY` (32 caracteres).

### 3. Iniciar todos os serviços
```bash
docker compose up -d
```
Isso iniciará automaticamente:
- **Frontend PWA**: `http://localhost:80`
- **Backend API**: `http://localhost:3001` (Healthcheck em `/health`)
- **MinIO Console**: `http://localhost:9001` (Credenciais: `ieqminio` / `ieqminio123`)
- **PostgreSQL**: Porta 5432 interna
- **Redis**: Porta 6379 interna
- **Backup Diário**: Agendador interno com retenção de 7 dias

---

## 🌐 Como Publicar em um Servidor com Docker (Produção VPS)

Para subir o sistema em uma VPS (Ubuntu/Debian) com Docker sem serviços pagos:

1. **Instalar Docker e Docker Compose na VPS**:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh
```

2. **Clonar o projeto e configurar o ambiente**:
```bash
git clone https://github.com/michellima20000-cloud/IEQ-blac.git /opt/ieq
cd /opt/ieq
cp .env.example .env
nano .env # configure senhas fortes e chaves de 32 chars
```

3. **Subir com Docker Compose**:
```bash
docker compose up -d --build
```

4. **Verificar os status e healthchecks**:
```bash
docker compose ps
```
Todos os serviços (`ieq_backend`, `ieq_frontend`, `ieq_postgres`, `ieq_redis`, `ieq_minio` e `ieq_backup`) devem constar como `healthy` ou `running`.

---

## 👑 Como Criar o Primeiro Usuário Pastor

Para inicializar a primeira igreja e criar o pastor administrador:

### Opção 1: Via Seed do Prisma (Recomendado)
```bash
docker compose exec backend npx prisma db seed
```
Isso cria a **Igreja Matriz** e o usuário inicial:
- **E-mail**: `pastor@ieq.org.br`
- **Senha**: `Pastor@123`

### Opção 2: Via API REST direta
Faça uma requisição `POST /api/v1/auth/setup-pastor` enviando:
```json
{
  "nome": "Pastor Presidente",
  "email": "pastor@ieq.org.br",
  "senha": "SuaSenhaSegura123!",
  "igrejaNome": "Igreja do Evangelho Quadrangular",
  "cidade": "Sua Cidade"
}
```

---

## ☁️ Como Configurar a Nuvem (Cloudflare R2 ou Backblaze B2 Gratuito)

Ambos os provedores oferecem planos gratuitos generosos compatíveis com a API S3 (10 GB no B2 ou 10 GB/mês no R2).

### No Cloudflare R2:
1. Acesse o painel da Cloudflare > **R2 Object Storage**.
2. Crie um bucket privado (ex: `ieq-backup-nuvem`).
3. Gere um **API Token** com permissão de Leitura e Escrita.
4. Adicione ao seu `.env`:
```env
CLOUD_S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
CLOUD_S3_BUCKET=ieq-backup-nuvem
CLOUD_S3_ACCESS_KEY=<ACCESS_KEY_ID>
CLOUD_S3_SECRET_KEY=<SECRET_ACCESS_KEY>
```

### No Backblaze B2:
1. Acesse o Backblaze B2 > **Buckets** > **Create a Bucket** (Marque como **Private**).
2. Vá em **Application Keys** e crie uma chave com acesso ao bucket criado.
3. Adicione ao seu `.env`:
```env
CLOUD_S3_ENDPOINT=https://s3.<regiao>.backblazeb2.com
CLOUD_S3_BUCKET=ieq-backup-nuvem
CLOUD_S3_ACCESS_KEY=<keyID>
CLOUD_S3_SECRET_KEY=<applicationKey>
```

---

## 🛡️ Como Restaurar um Backup

Os backups do PostgreSQL são gerados diariamente e salvos criptografados com **AES-256-CBC**.

### 1. Descriptografar e Restaurar o Banco de Dados
Para restaurar o arquivo `backup-2026-11-06.sql.enc`:

```bash
# 1. Descriptografe o arquivo utilizando a chave BACKUP_ENCRYPTION_KEY configurada
openssl enc -d -aes-256-cbc -pbkdf2 \
  -in /backups/backup-2026-11-06.sql.enc \
  -out /backups/backup_restaurado.sql \
  -k "SUA_BACKUP_ENCRYPTION_KEY_32_CHARS"

# 2. Restaure o dump SQL no container PostgreSQL
docker compose exec -T postgres psql -U ieq -d ieq < /backups/backup_restaurado.sql
```

### 2. Restaurar os Arquivos e Fotos do MinIO
Se precisar restaurar arquivos do bucket remoto (R2/B2):
```bash
# Sincronizar da nuvem diretamente para o volume do MinIO local
rclone copy remote:ieq-backup-nuvem/fotos /data/ieq-files
```

---

## 🧪 Execução de Testes Automatizados

O backend possui suíte de testes de permissão, RBAC, autenticação, trava de relatórios, módulo de mídia, vitrine pública e ciclo de vida de armazenamento sem dependências externas:

```bash
cd backend
node --experimental-strip-types --test tests/permissions.node.mjs tests/auth_usuarios.node.mjs tests/celulas_relatorios.node.mjs tests/midia_aprovacao.node.mjs tests/storage_limpeza.node.mjs tests/vitrine_publica.node.mjs
```
**Resultado esperado:** 58 testes passando, 0 falhas.

---

## 🔗 Vitrine Pública (link compartilhável sem login)

Cada igreja pode divulgar seus avisos, banners, vídeos e a agenda de eventos por um link público, **sem exigir conta ou senha**:

```
https://<dominio>/vitrine/ieq-cidade-nova
```

- **Onde encontrar o link:** aba **Visual** (Estúdio de Personalização) para a equipe de Mídia e aba **Aprovações** para o Pastor — com botão "Copiar" e "Abrir".
- **Identificador (slug):** é o mesmo usado no login (ex.: `ieq-cidade-nova`). O sistema aceita variações de escrita (`IEQ Cidade Nova`, `ieq_cidade_nova`).
- **API pública:** `GET /api/v1/publico/vitrine/:slug` (sem autenticação), com cache de 60 segundos.
- **Segurança:** só conteúdo com status **PUBLICADO** aparece. Conteúdo pendente, rascunho ou devolvido nunca é exposto, e **nenhum** dado de células, membros, visitantes ou relatórios é exposto — a regra de isolamento do perfil MIDIA continua valendo.
- **Personalização:** a página pública usa o logo, as cores e o layout (Grade, Carrossel ou Lista) definidos no Estúdio de Personalização.
- **Deploy:** o `frontend/vercel.json` contém o *rewrite* SPA necessário para `/vitrine/:slug`; o nginx do Docker já faz fallback para `index.html`.

---

## 📋 Perfis de Acesso e Regras de Segurança

| Perfil | Acesso Permitido | Restrições Mandatórias |
| :--- | :--- | :--- |
| **CELULA** | Sua própria célula, cadastro de membros/visitantes e relatório semanal com câmera. | **Bloqueado** em células vizinhas e de outras redes. Relatório após fechado não pode ser editado. |
| **REDE** | Leitura de relatórios fechados com foto de sua rede, consolidado semanal e lista de pendências. | **Bloqueado** em redes alheias. Não edita membros de células. |
| **PASTOR** | Acesso global à igreja: indicadores, aprovação/devolução de mídia, gestão de usuários e alertas de backup. | Restrito aos dados da **sua própria igreja** (isolamento multi-tenant). |
| **MIDIA** | Upload de mídias/vídeos (50MB/YouTube), calendário, personalização visual e status de aprovação. | ⚠️ **PROIBIDO**: Zero acesso a células, membros, visitantes e relatórios. |
