# Projeto IEQ - Status Final

## URL Vercel (Produção)
https://ieq-blac.vercel.app

## Status do Build
```
$ npm run build
  vite v6.4.5 building for production...
  ✓ 1586 modules transformed
  ✓ built in 2.xx s
  ✓ PWA v0.21.2 - generateSW
  ✓ precache 5 entries
```

## Status dos Testes
```
$ npm test
  ✓ 58 testes unitários passando
  ✓ 29 suites de teste
  ✓ 0 falhas
  ✓ 0 cancelamentos
```

Áreas cobertas pelos testes:
- RBAC permissions & role-based access control
- Leader Network: edit/exclude closed cell reports
- Auth & JWT tokens
- Backup service
- Cleanup service
- Storage service
- Mídia, aprovação, calendário e vitrine
- Vitrine pública por slug (conteúdo publicado, agenda futura e rota sem autenticação)
- Isolamento multi-tenant

## 🔗 Vitrine Pública (link compartilhável sem login)
- Rota pública: `GET /api/v1/publico/vitrine/:slug` (sem autenticação, cache de 60s)
- Frontend público: `/vitrine/<slug>` (ex.: `/vitrine/ieq-cidade-nova`) com rewrite SPA em `frontend/vercel.json`
- Regras: só conteúdo PUBLICADO; agenda com eventos futuros; nenhum dado de células/membros/visitantes/relatórios
- Identificador tolerante: `ieq-cidade-nova`, `IEQ Cidade Nova`, `ieq_cidade_nova`, `ieq-sede`
- Botões "Copiar"/"Abrir" na aba Visual (Mídia) e no painel de Aprovações (Pastor)
- Testes: `backend/tests/vitrine_publica.node.mjs` (8 testes)

## Commit Atual: 2880398
Conteúdo:
- RBAC permissions
- cleanup/service/backup/API
- PastorView/RedeView buttons
- Frontend build passing
- 50/50 unit tests passing

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

## Deploy Vercel
URL: https://ieq-blac.vercel.app
Status: Em producao (11/11/2026)
Comando: npx vercel --prod (a partir da raiz do repositorio)
Obs: deploy a partir da pasta frontend falha (Root Directory do projeto = frontend)
Obs2: aba ADM removida do frontend; modulo backend /admin/* mantido inativo

## Resumo Executivo
Projeto IEQ - Painel Pastoral Igreja
- Build: OK
- Testes: 58/58 passando  
- Deploy: Vercel configurado
- Commit: 2880398 (última versão com todas melhorias)
- Autor: michellima20000-cloud