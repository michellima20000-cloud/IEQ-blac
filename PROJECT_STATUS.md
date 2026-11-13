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
  ✓ 72 testes unitários passando
  ✓ 37 suites de teste
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
- Upload de mídia (campo "arquivo"/"arquivos", normalização e MIME real)
- Vídeo para a vitrine (bytes no banco, MIME de vídeo e rota pública do arquivo)
- Isolamento multi-tenant

## 🎬 Vídeo para a vitrine (upload de arquivo)
- Diagnóstico: o backend convertia o vídeo inteiro em base64 dentro do JSON;
  a memória da API (Render free, 512 MB) estourava e o upload voltava com 502
  a partir de ~20 MB (15 MB funcionavam, 20 MB caíam).
- Correção: o vídeo é gravado em **bytes crus** no banco (`conteudos_midia.arquivoBytes`),
  sem base64 no JSON e na resposta da API.
- Novo endpoint público `GET /api/v1/midia/:id/arquivo` (com Range) serve o arquivo:
  conteúdo PUBLICADO é público (vitrine compartilhável); pendente/devolvido exige
  usuário da mesma igreja (`Bearer` ou `?token=`).
- MIME real detectado pelos bytes: MP4, MOV (QuickTime), WebM, AVI e OGG.
- Limite mantido em 50 MB; imagens seguem o fluxo antigo (WebP + data URL).

## 🔗 Vitrine Pública (link compartilhável sem login)
- Rota pública: `GET /api/v1/publico/vitrine/:slug` (sem autenticação, cache de 60s)
- Frontend público: `/vitrine/<slug>` (ex.: `/vitrine/ieq-cidade-nova`) com rewrite SPA em `frontend/vercel.json`
- Regras: só conteúdo PUBLICADO; agenda com eventos futuros; nenhum dado de células/membros/visitantes/relatórios
- Identificador tolerante: `ieq-cidade-nova`, `IEQ Cidade Nova`, `ieq_cidade_nova`, `ieq-sede`
- Botões "Copiar"/"Abrir" na aba Visual (Mídia) e no painel de Aprovações (Pastor)
- Testes: `backend/tests/vitrine_publica.node.mjs` (8 testes)

## Commit Atual: 0e49465
Conteúdo:
- Correção do upload para a vitrine (campo "arquivo" do app aceito no back)
- MIME real do arquivo no fallback sem sharp
- Vitrine pública por slug (link compartilhável sem login)
- API pública /publico/vitrine/:slug + cache de 60s
- Página pública /vitrine/<slug> com a identidade visual da igreja
- RBAC permissions
- cleanup/service/backup/API
- Frontend build passing
- 72/72 unit tests passing

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
Vitrine pública: https://ieq-blac.vercel.app/vitrine/ieq-cidade-nova
Status: Em producao (12/11/2026) - deploy automatico via GitHub (commit a13f319)
Obs: o deploy e feito pelo GitHub (push em main); a CLI do Vercel exige login local
Obs2: aba ADM removida do frontend; modulo backend /admin/* mantido inativo
Obs3: API publica no Render: https://ieq-black.onrender.com/api/v1/publico/vitrine/:slug

## Resumo Executivo
Projeto IEQ - Painel Pastoral Igreja
- Build: OK
- Testes: 72/72 passando  
- Deploy: Vercel configurado (auto-deploy via GitHub) + Render para a API
- Commit: a13f319 (vitrine pública + todas melhorias anteriores)
- Autor: michellima20000-cloud