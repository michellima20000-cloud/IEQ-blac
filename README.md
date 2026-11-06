# Sistema de Gestão da Igreja (IEQ)

Sistema completo de gestão de células, liderança, mídia e relatórios com isolamento multi-tenant por igreja (`igreja_id`) e controle de acesso baseado em perfis (RBAC).

---

## 🏛️ Regras Fundamentais do Projeto (`.agent/rules/igreja.md`)

- **Projetos desacoplados**: `/backend` e `/frontend` são independentes. O front consome exclusivamente a API REST.
- **Validação no Back-end**: Toda permissão e isolamento por igreja (`igreja_id`) são estritamente validados no servidor.
- **Perfil Mídia**: Nunca acessa dados de células, membros, visitantes ou relatórios.
- **Armazenamento**: MinIO local + replicação na nuvem (R2 ou B2). Nenhum serviço pago obrigatório.
- **Limpeza Automática**: Fotos de relatórios de células são expurgadas após o período configurado (padrão 60 dias). O relatório é preservado.
- **Tudo em Docker**: Todo o ecossistema roda orquestrado via `docker-compose.yml`.

---

## 📁 Estrutura do Repositório

```
/
├── .agent/rules/igreja.md          # Regras permanentes do projeto
├── docker-compose.yml              # PostgreSQL, Redis, MinIO, Backup, Backend, Frontend
├── .env.example                    # Modelo de configuração do ambiente
├── backend/                        # API Node.js + TypeScript + Prisma + BullMQ
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   ├── schema.prisma           # Modelagem com igreja_id em todas as tabelas
│   │   └── seed.ts                 # 1 igreja, 2 redes, 4 células, 4 usuários
│   ├── src/
│   │   ├── config/                 # Envs, Swagger, Storage, Criptografia
│   │   ├── middlewares/            # Auth JWT, Tenant (igreja_id), RBAC, RateLimit
│   │   ├── modules/
│   │   │   ├── auth/               # Login, Refresh, Logout
│   │   │   ├── usuarios/           # Gestão de usuários pelo Pastor
│   │   │   ├── celulas/            # Células, Membros, Visitantes, Relatórios, Consolidado
│   │   │   └── midia/              # Mídia, Aprovação, Calendário, Vitrine, Cores
│   │   ├── services/
│   │   │   ├── storage.service.ts  # MinIO S3 & URLs assinadas
│   │   │   ├── imageProcessor.ts   # Compressão WebP (máx. 1280px)
│   │   │   ├── cloudSync.service.ts# Sincronização resiliente R2 / B2
│   │   │   ├── backup.service.ts   # Backup diário Postgres criptografado (AES-256)
│   │   │   └── cleanup.service.ts  # Expurgador de fotos vencidas (preserva dados)
│   │   └── jobs/
│   │       └── queues.ts           # BullMQ Queues
│   └── tests/
│       ├── permissions.node.mjs    # Testes Etapa 1
│       ├── auth_usuarios.node.mjs  # Testes Etapa 2
│       ├── celulas_relatorios.node.mjs # Testes Etapa 3
│       ├── midia_aprovacao.node.mjs # Testes Etapa 4
│       └── storage_limpeza.node.mjs # Testes Etapa 5
└── frontend/                       # React + Vite + PWA instalável
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    ├── vite.config.ts
    └── src/
```

---

## 💾 Procedimentos de Restauração de Desastres (Backup & Arquivos)

### 1. Restauração do Banco de Dados PostgreSQL

Os backups são gerados diariamente, criptografados com **AES-256-CBC** e mantidos pelos últimos 7 dias.

#### Passo a passo de restauração:
1. Obtenha o arquivo de backup criptografado (ex: `backup_ieq_2026-11-06.sql.enc`).
2. Descriptografe o arquivo utilizando a chave configurada em `BACKUP_ENCRYPTION_KEY`:
   ```bash
   openssl enc -d -aes-256-cbc -pbkdf2 \
     -in backup_ieq_2026-11-06.sql.enc \
     -out backup_restaurado.sql \
     -pass pass:"SUA_CHAVE_BACKUP_ENCRYPTION_KEY"
   ```
3. Importe o dump descriptografado diretamente para o container PostgreSQL:
   ```bash
   docker exec -i ieq_postgres psql -U postgres -d ieq_db < backup_restaurado.sql
   ```
4. Exclua o arquivo `.sql` plano temporário:
   ```bash
   rm backup_restaurado.sql
   ```

### 2. Restauração de Arquivos da Nuvem (R2 / B2) para o MinIO Local

Caso precise restaurar todos os arquivos da nuvem privada para o MinIO local via `rclone`:

```bash
# Sincroniza do bucket remoto (R2/B2) para o MinIO local
rclone sync remote-r2:ieq-backup-privado local-minio:ieq-local --progress
```

---

## 🧹 Regra de Limpeza Automática de Fotos de Relatórios

- Executada automaticamente todos os dias às 03:00.
- Prazo de retenção: configurável pelo Pastor (padrão **60 dias**).
- Fotos com mais de 60 dias são apagadas do MinIO e do bucket na nuvem.
- **Exceção**: Relatórios com a opção `"manter esta foto"` marcada **NÃO** são apagados.
- **Os dados numéricos e o texto do relatório permanecem 100% intactos**.
- Alerta com 7 dias de antecedência para líderes de rede e pastor.
- Banners e fotos da mídia **nunca** são afetados pela limpeza.

---

## 🧪 Testes Automatizados

Para rodar toda a suíte de testes (Etapas 1, 2, 3, 4 e 5):

```bash
cd backend
npm test
```
