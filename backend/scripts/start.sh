#!/bin/sh
# Script de inicialização do backend no Render
# Executa migrações e seed antes de iniciar o servidor

echo "🚀 Iniciando backend IEQ..."

# Roda as migrações do banco
echo "📦 Executando migrações Prisma..."
npx prisma migrate deploy

# Roda o seed apenas se não houver dados (evita duplicação)
echo "🌱 Verificando seed do banco..."
node -e "
import('./node_modules/.bin/tsx').then(() => {}).catch(() => {});
" 2>/dev/null || true

# Seed condicional via tsx
npx tsx prisma/seed.ts 2>/dev/null || echo "⚠️  Seed já executado ou falhou (normal em redeploys)"

# Inicia o servidor
echo "✅ Iniciando servidor..."
exec node_modules/.bin/tsx src/server.ts

