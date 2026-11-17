# Projeto IEQ - Status do Sistema

## Produção
- Frontend (Vercel): https://ieq-blac.vercel.app
- Vitrine pública: https://ieq-blac.vercel.app/vitrine/ieq-cidade-nova
- API (Render): https://ieq-black.onrender.com (`GET /api/v1/health` → 200)
- Vitrine pública (API): https://ieq-black.onrender.com/api/v1/publico/vitrine/:slug

## Status do Build (frontend)
```
$ npm run build
  vite v6.4.5 building for production...
  ✓ 1592 modules transformed
  ✓ PWA v0.21.2 - generateSW
  ✓ precache 27 entries
```

## Status dos Testes (backend)
```
$ npm test
  ✓ 98 testes passando
  ✓ 45 suites
  ✓ 0 falhas
  ✓ 0 cancelamentos
```

Áreas cobertas pelos testes:
- RBAC e isolamento multi-tenant (inclusive falha fechada sem vínculo de rede/célula)
- Segurança: `SETUP_SECRET` (rotas de manutenção), restrição de perfil `ADM`, aprovação de mídia
- Leader Network: edição/exclusão de relatórios fechados
- Auth & JWT
- Backup (criptografia) e limpeza (retenção)
- Armazenamento
- Mídia, aprovação, calendário e vitrine
- Vitrine pública por slug (conteúdo publicado, agenda futura e rota sem autenticação)
- Upload de mídia (campo "arquivo"/"arquivos", normalização, MIME real) e vídeo (pedaços, Range, rota pública)

## 🎬 Vídeo para a vitrine (upload de arquivo)
- **Diagnóstico:** o backend convertia o vídeo inteiro em base64 dentro do JSON;
  a memória da API (Render free, 512 MB) estourava e o upload voltava com 502
  a partir de ~20 MB (15 MB funcionavam, 20 MB caíam).
- **Correção:**
  1. o upload vai para o **disco** (`multer.diskStorage`) — a API não segura o vídeo na memória;
  2. o vídeo é lido em **pedaços de 4 MB** e gravado na tabela `midia_arquivo_partes`;
  3. o arquivo é servido em fluxo por `GET /api/v1/midia/:id/arquivo`, com **Range**;
  4. nada de base64 no JSON nem na resposta da API.
- **Rota pública:** conteúdo PUBLICADO é público (vitrine compartilhável);
  pendente/devolvido exige usuário da mesma igreja (`Bearer` ou `?token=`).
  O router fica em `midia/arquivo.publico.routes.ts`, montado **antes** do router de
  células (que exige token em todos os caminhos).
- **MIME real** detectado pelos bytes: MP4, MOV (QuickTime), WebM, AVI e OGG.
- Limite de **50 MB**.
- **Validado em produção (13/11/2026):** 1 MB, 10 MB, 25 MB e 45 MB → 201 OK;
  download público 200 com os bytes idênticos e Range respondendo 206.

## 🗄️ Onde ficam os arquivos da vitrine (regra do projeto)
**Nenhum arquivo é embutido como texto base64.** Fotos, vídeos e logo ficam gravados
como bytes no Postgres e são servidos pela API:

| arquivo | tabela | rota |
| :--- | :--- | :--- |
| Foto / Banner / Aviso com imagem | `midia_arquivo_partes` | `GET /api/v1/midia/:id/arquivo` |
| Vídeo | `midia_arquivo_partes` | `GET /api/v1/midia/:id/arquivo` (Range) |
| Logo da igreja | `arquivos_igreja` | `GET /api/v1/logo/:igrejaId` |

- `arquivoUrl` guarda só o caminho (`/midia/<id>/arquivo`); o front resolve com `urlMidia()`.
- Migração automática no boot: mídias e logos antigos em base64 viram bytes no banco.
- **Efeito medido em produção:** resposta da vitrine pública **3.207.616 → ~1.400 bytes**;
  `/publico/visual/:slug` **340.960 → 164 bytes**.

## 🔗 Vitrine Pública (link compartilhável sem login)
- Rota pública: `GET /api/v1/publico/vitrine/:slug` (sem autenticação, cache de 60s)
- Frontend público: `/vitrine/<slug>` (ex.: `/vitrine/ieq-cidade-nova`) com rewrite SPA em `frontend/vercel.json`
- Regras: só conteúdo PUBLICADO; agenda com eventos futuros; nenhum dado de células/membros/visitantes/relatórios
- Identificador tolerante: `ieq-cidade-nova`, `IEQ Cidade Nova`, `ieq_cidade_nova`, `ieq-sede`
- Botões "Copiar"/"Abrir" na aba Visual (Mídia) e no painel de Aprovações (Pastor)
- Testes: `backend/tests/vitrine_publica.node.mjs` (8 testes)

## Segurança e Manutenção (atualização)
- **`SETUP_SECRET`**: `GET /api/v1/setup-db` e `POST /api/v1/admin/bootstrap` exigem o segredo (`x-setup-secret`); sem ele as rotas ficam desabilitadas (503).
- **JWT**: obrigatório em produção (mín. 16 caracteres); em dev, se ausente, segredo aleatório por processo (nunca fixo no código). Credencial Redis removida do código.
- **ADM**: só o Administrador concede/altera perfil `ADM` (Pastor não escala privilégios).
- **RBAC**: líder de rede/célula sem vínculo é bloqueado (falha fechada); perfil `MIDIA` sem acesso a listagens de células/redes.
- **`render.yaml`**: serviço `ieq-black`, `healthCheckPath` `/api/v1/health`, `FRONTEND_URL=https://ieq-blac.vercel.app`, segredos em `sync: false` no painel do Render e `SETUP_SECRET` gerado. Credenciais anteriormente versionadas devem ser rotacionadas.

## Retenção, Armazenamento e Backup (atualização)
- **Prazo de retenção de fotos**: configurável pelo Pastor (1–365 dias, padrão 60) — `GET/PATCH /configuracoes/retencao` (`PASTOR`/`ADM`). Job de limpeza usa o prazo configurado (corrigido typo que quebrava a limpeza).
- **Armazenamento**: métricas calculadas com dados reais do banco (`midia_arquivo_partes`, `arquivos_igreja`, fotos de relatórios).
- **Backup**: rotina diária gera dump real (pg_dump ou exportação JSON das tabelas, sem bytes binários das partes), criptografa AES-256-CBC e grava em disco com retenção.

## Correções aplicadas (backend + frontend)
- **Mídia**: upload em disco com limpeza de temporários; aprovação respeita o campo "precisaAprovacao" (quando desmarcado publica direto, quando marcado vai para o Pastor); MIDIA edita só o próprio conteúdo; await no delete; Range/sufixo e Content-Length corretos no streaming; autorização antes de metadados.
- **Painéis**: relatórios (Pastor/Rede) sem `fotoUrl` base64 no payload — fotos carregadas sob demanda por URL assinada.
- **Frontend**: seleção de arquivo de mídia corrigida (stale state) com `accept image/*,video/*`; sessão expirada encerra ao falhar refresh; slider de retenção ligado à API; status real do membro; erros de carregamento exibidos; correção de listeners PWA.
- **Swagger**: YAML corrigido (descrição com `:` entre aspas).
- **Docker/Deploy**: frontend mapeado para porta 80 do nginx; Dockerfile do front com `npm run build`; `render.yaml` alinhado ao serviço real.

## Qualidade do Code
- Frontend: TypeScript/Vite build - SEM ERROS
- Backend: Node.js com expressividade completa
- JSX syntax: Correta em todos os componentes
- RBAC protection: Implementada corretamente
- Conditional rendering: Sintaxe válida
- Vitrine: botões removidos sobre foto; metadados agora só aparecem quando não há imagem (ou em overlay ao passar o mouse)
- Vitrine pública: página independente de login, com logo/cores/layout do Estúdio de Personalização e visualizador ampliado das imagens
- PastorView: cards de estatísticas (Células Ativas, Membros Ativos, Novos Visitantes, Frequência Média) agora possuem onClick para abrir detalhes
- Painel lateral de células: width reduzido (w-24), padding reduzido (p-1) e botão fechar menor (h-10), agora ocupa o mínimo espaço lateral da tela

## Deploy
- **Vercel (frontend)**: https://ieq-blac.vercel.app (auto-deploy via GitHub no push em `main`; CLI exige login local).
- **Render (API)**: https://ieq-black.onrender.com — blueprint em `render.yaml`. Variáveis sensíveis configuradas no painel do Render.
- **Docker local**: `docker compose up -d --build` (`frontend` exposto em `${FRONTEND_PORT:-80}:80`).

## Observações
- Para rodar o backend localmente com banco real é necessária a *connection string externa* do Postgres do Render (o host interno não é acessível fora da rede do Render).
- Alterações locais validadas (build + 98 testes) mas **não commitadas/pushadas** e nenhum deploy remoto foi disparado.