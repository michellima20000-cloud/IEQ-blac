# Sistema de Gestão da Igreja (IEQ)

Sistema completo de gestão de células, liderança, mídia e relatórios com isolamento multi-tenant por igreja (`igreja_id`) e controle de acesso baseado em perfis (RBAC).

---

## 🏛️ Regras Fundamentais do Projeto (`.agent/rules/igreja.md`)

- **Projetos desacoplados**: `/backend` e `/frontend` são independentes. O front consome exclusivamente a API REST.
- **Validação no Back-end**: Toda permissão e isolamento por igreja (`igreja_id`) são estritamente validados no servidor.
- **Perfil Mídia**: Nunca acessa dados de células, membros, visitantes ou relatórios.
- **Armazenamento**: MinIO local + replicação na nuvem (R2 ou B2). Nenhum serviço pago obrigatório.
- **Limpeza Automática**: Fotos de relatórios de células são expurgadas após o período configurado (padrão 60 dias).
- **Docker**: Todo o ecossistema roda orquestrado via `docker-compose.yml`.

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
│   │   ├── permissions/            # Módulo RBAC e isolamento multi-tenant
│   │   └── server.ts               # Servidor Express com /api/health
│   └── tests/
│       └── permissions.node.mjs    # Testes automatizados das regras mandatórias
└── frontend/                       # React + Vite + PWA instalável
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    ├── vite.config.ts
    └── src/
```

---

## 🧪 Testes Automatizados da Etapa 1

Para executar a suíte de testes de permissão e isolamento:

```bash
cd backend
npm test
```

### Regras verificadas e aprovadas:
1. ✅ **Líder de Célula**: Acessa apenas sua própria célula.
2. ✅ **Líder de Rede**: Acessa todas as células da sua rede, bloqueado em outras redes.
3. ✅ **Perfil Mídia**: Bloqueado de qualquer acesso a células, membros, visitantes e relatórios.
4. ✅ **Isolamento de Igreja**: Nenhum usuário acessa dados com `igreja_id` divergente.
5. ✅ **Pastor**: Acesso completo e irrestrito aos recursos da sua igreja.
