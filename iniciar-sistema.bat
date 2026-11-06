@echo off
echo ========================================================
echo IEQ Conecta - Iniciando Sistema Completo Localmente
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/3] Verificando banco de dados PostgreSQL e Redis...
docker start ieq_postgres 2>nul || docker run -d --name ieq_postgres -e POSTGRES_DB=ieq -e POSTGRES_USER=ieq -e POSTGRES_PASSWORD=ieqpassword -p 5432:5432 postgres:16-alpine
docker start ieq_redis 2>nul || docker run -d --name ieq_redis -p 6379:6379 redis:7-alpine redis-server --requirepass ieqredis

echo.
echo [2/3] Instalando dependencias e iniciando o BACKEND (Porta 3001)...
start "IEQ Backend" cmd /k "cd backend && npm install && npx prisma db push && npm run dev"

echo.
echo [3/3] Instalando dependencias e iniciando o FRONTEND (Porta 3000)...
start "IEQ Frontend" cmd /k "cd frontend && npm install && npm run dev"

echo.
echo ========================================================
echo Sistema iniciado!
echo.
echo Acesse no seu navegador: http://localhost:3000
echo.
echo Dados para entrar:
echo  - SLUG DA IGREJA: ieq-sede
echo  - E-MAIL: pastor@ieq.com
echo  - SENHA: Pastor@123
echo ========================================================
pause

