Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "IEQ - Enviar repositorio para o GitHub" -ForegroundColor Cyan
Write-Host "Repositorio: https://github.com/michellima20000-cloud/IEQ-blac.git" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $PSScriptRoot

$gitExe = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Git.MinGit_Microsoft.Winget.Source_8wekyb3d8bbwe\cmd\git.exe"

if (-not (Test-Path $gitExe)) {
    if (Get-Command git -ErrorAction SilentlyContinue) {
        $gitExe = "git"
    } else {
        Write-Host "[ERRO] Executável do Git não encontrado." -ForegroundColor Red
        exit 1
    }
}

Write-Host "[1/3] Configurando remote origin..." -ForegroundColor Yellow
& $gitExe remote set-url origin https://github.com/michellima20000-cloud/IEQ-blac.git
& $gitExe branch -M main

Write-Host "[2/3] Enviando commits para o GitHub..." -ForegroundColor Yellow
Write-Host "(Se abrir a janela do navegador, confirme a autorização da conta michellima20000-cloud)" -ForegroundColor DarkGray
& $gitExe push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================================" -ForegroundColor Green
    Write-Host "SUCESSO! Repositório atualizado no GitHub:" -ForegroundColor Green
    Write-Host "https://github.com/michellima20000-cloud/IEQ-blac" -ForegroundColor Green
    Write-Host "========================================================" -ForegroundColor Green

    Write-Host ""
    Write-Host "[3/3] Sincronizando frontend com a Vercel (IEQ-front)..." -ForegroundColor Yellow
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "sync-front.ps1")
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "[AVISO] Frontend não foi publicado na Vercel. Rode sync-front.ps1 manualmente." -ForegroundColor Red
    }
} else {
    Write-Host ""
    Write-Host "[AVISO] Falha ao enviar para o GitHub. Verifique a autenticação." -ForegroundColor Red
}

