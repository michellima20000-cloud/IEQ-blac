@echo off
echo ========================================================
echo IEQ - Build e Push das Imagens para o Docker Hub
echo Usuario Docker: michelsilva10
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/4] Realizando login no Docker Hub...
docker login -u michelsilva10
if errorlevel 1 (
    echo.
    echo [ERRO] Falha na autenticacao do Docker Hub.
    pause
    exit /b 1
)

echo.
echo [2/4] Construindo imagem do BACKEND (michelsilva10/ieq-blac:latest)...
docker build -t michelsilva10/ieq-blac:latest ./backend
if errorlevel 1 (
    echo.
    echo [ERRO] Falha ao construir o backend.
    pause
    exit /b 1
)

echo.
echo [3/4] Construindo imagem do FRONTEND (michelsilva10/ieq-front:latest)...
docker build -t michelsilva10/ieq-front:latest ./frontend
if errorlevel 1 (
    echo.
    echo [ERRO] Falha ao construir o frontend.
    pause
    exit /b 1
)

echo.
echo [4/4] Enviando imagens para o Docker Hub...
echo Enviando michelsilva10/ieq-blac:latest...
docker push michelsilva10/ieq-blac:latest

echo Enviando michelsilva10/ieq-front:latest...
docker push michelsilva10/ieq-front:latest

echo.
echo ========================================================
echo Sucesso! Imagens publicadas no Docker Hub:
echo  - https://hub.docker.com/r/michelsilva10/ieq-blac
echo  - https://hub.docker.com/r/michelsilva10/ieq-front
echo ========================================================
pause
