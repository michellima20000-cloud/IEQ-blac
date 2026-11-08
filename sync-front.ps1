Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "IEQ - Sincronizar frontend e publicar na Vercel" -ForegroundColor Cyan
Write-Host "frontend/ -> github.com/michellima20000-cloud/IEQ-front" -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $PSScriptRoot

$src = Join-Path $PSScriptRoot "frontend"
$work = Join-Path $env:TEMP "ieq-front-sync"
$remoteRepo = "https://github.com/michellima20000-cloud/IEQ-front.git"

if (-not (Test-Path $src)) {
    Write-Host "[ERRO] Pasta frontend/ nao encontrada." -ForegroundColor Red
    exit 1
}

# Reutiliza o token do remote origin do IEQ-blac se existir
$originUrl = git remote get-url origin 2>$null
$tokenMatch = [regex]::Match("$originUrl", "https://([^@]+)@github\.com")
if ($tokenMatch.Success) {
    $cloneUrl = "https://$($tokenMatch.Groups[1].Value)@github.com/michellima20000-cloud/IEQ-front.git"
} else {
    $cloneUrl = $remoteRepo
}

Write-Host "[1/4] Preparando copia de trabalho do IEQ-front..." -ForegroundColor Yellow
if (Test-Path $work) {
    git -C $work remote set-url origin $cloneUrl 2>$null
    git -C $work fetch origin --quiet
    if ($LASTEXITCODE -ne 0) { Write-Host "[ERRO] Falha ao acessar o repositorio IEQ-front." -ForegroundColor Red; exit 1 }
    git -C $work reset --hard origin/main --quiet
} else {
    git clone $cloneUrl $work --quiet
    if ($LASTEXITCODE -ne 0) { Write-Host "[ERRO] Falha ao clonar o repositorio IEQ-front." -ForegroundColor Red; exit 1 }
}
git -C $work config user.name "michellima20000-cloud"
git -C $work config user.email "michellima20000-cloud@users.noreply.github.com"

Write-Host "[2/4] Espelhando pasta frontend/..." -ForegroundColor Yellow
robocopy $src $work /MIR /XD node_modules dist .git /NFL /NDL /NJH /NP | Out-Null
if ($LASTEXITCODE -ge 8) {
    Write-Host "[ERRO] Falha ao copiar os arquivos (codigo $LASTEXITCODE)." -ForegroundColor Red
    exit 1
}

# Garante que builds locais nunca sejam publicados
Set-Content -Path (Join-Path $work ".gitignore") -Value "node_modules/`ndist/`n.DS_Store" -Encoding ascii

git -C $work add -A
$pendentes = git -C $work status --porcelain
if (-not $pendentes) {
    Write-Host ""
    Write-Host "=========================================================" -ForegroundColor Green
    Write-Host "Nada a publicar: IEQ-front ja esta igual ao frontend/." -ForegroundColor Green
    Write-Host "=========================================================" -ForegroundColor Green
    exit 0
}

Write-Host "[3/4] Gerando commit..." -ForegroundColor Yellow
$stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
git -C $work commit -m "sync: atualizar frontend ($stamp)" --quiet
if ($LASTEXITCODE -ne 0) { Write-Host "[ERRO] Falha ao criar o commit." -ForegroundColor Red; exit 1 }

Write-Host "[4/4] Enviando para o GitHub (Vercel faz o deploy automatico)..." -ForegroundColor Yellow
git -C $work push origin main --quiet
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[ERRO] Falha no push do IEQ-front." -ForegroundColor Red
    Write-Host "Verifique a autenticacao do GitHub (git-push.ps1 pede login no navegador)." -ForegroundColor DarkGray
    exit 1
}

Write-Host ""
Write-Host "=========================================================" -ForegroundColor Green
Write-Host "PUBLICADO! Deploy da Vercel iniciado." -ForegroundColor Green
Write-Host "IEQ-front: https://github.com/michellima20000-cloud/IEQ-front" -ForegroundColor Green
Write-Host "Site:      https://ieq-quadragular.vercel.app" -ForegroundColor Green
Write-Host "(pronto em ~1 minuto - use Ctrl+F5 para ver)" -ForegroundColor DarkGray
Write-Host "=========================================================" -ForegroundColor Green
