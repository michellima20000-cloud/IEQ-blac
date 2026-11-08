@echo off
echo ========================================================
echo IEQ - Enviar repositorio para o GitHub
echo Repositorio: https://github.com/michellima20000-cloud/IEQ-blac.git
echo ========================================================
echo.

cd /d "%~dp0"

set "GIT_EXE=%LOCALAPPDATA%\Microsoft\WinGet\Packages\Git.MinGit_Microsoft.Winget.Source_8wekyb3d8bbwe\cmd\git.exe"

if not exist "%GIT_EXE%" (
    where git >nul 2>nul
    if %errorlevel% equ 0 (
        set "GIT_EXE=git"
    ) else (
        echo [ERRO] Git nao encontrado na maquina.
        pause
        exit /b 1
    )
)

echo [1/3] Verificando branch e remote...
"%GIT_EXE%" remote set-url origin https://github.com/michellima20000-cloud/IEQ-blac.git
"%GIT_EXE%" branch -M main

echo [2/3] Enviando commits para o GitHub...
echo (Se solicitado, autorize com sua conta michellima20000-cloud no navegador ou informe seu Token)
"%GIT_EXE%" push -u origin main

if %errorlevel% equ 0 (
    echo.
    echo ========================================================
    echo SUCESSO! Repositorio atualizado no GitHub:
    echo https://github.com/michellima20000-cloud/IEQ-blac
    echo ========================================================
    echo.
    echo [3/3] Sincronizando frontend com a Vercel (IEQ-front)...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync-front.ps1"
    if errorlevel 1 (
        echo.
        echo [AVISO] Frontend nao foi publicado na Vercel. Rode sync-front.ps1 manualmente.
    )
) else (
    echo.
    echo [AVISO] Ocorreu um erro no push. Verifique suas credenciais do GitHub.
)

pause

