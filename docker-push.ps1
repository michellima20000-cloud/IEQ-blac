Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "IEQ - Build e Push para o Docker Hub" -ForegroundColor Cyan
Write-Host "Conta: michelsilva10" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $PSScriptRoot

Write-Host "[1/4] Autenticando no Docker Hub com usuário michelsilva10..." -ForegroundColor Yellow
docker login -u michelsilva10
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERRO] Falha no login do Docker Hub." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[2/4] Construindo imagem do BACKEND (michelsilva10/ieq-blac:latest)..." -ForegroundColor Yellow
docker build -t michelsilva10/ieq-blac:latest ./backend
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERRO] Falha no build do backend." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[3/4] Construindo imagem do FRONTEND (michelsilva10/ieq-front:latest)..." -ForegroundColor Yellow
docker build -t michelsilva10/ieq-front:latest ./frontend
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERRO] Falha no build do frontend." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[4/4] Enviando imagens para o Docker Hub..." -ForegroundColor Yellow
docker push michelsilva10/ieq-blac:latest
docker push michelsilva10/ieq-front:latest

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "Sucesso! Imagens disponíveis em:" -ForegroundColor Green
Write-Host " - https://hub.docker.com/r/michelsilva10/ieq-blac" -ForegroundColor Green
Write-Host " - https://hub.docker.com/r/michelsilva10/ieq-front" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green

