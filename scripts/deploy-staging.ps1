# Заливка staging БЕЗ GitHub Actions (Windows).
# Копирует deploy.staging.env -> deploy.env и запускает тот же deploy.sh, что и на Linux.
# Нужны: Node, npm, Git for Windows (bash) или WSL.
#
# Запуск из корня репозитория:
#   powershell -ExecutionPolicy Bypass -File .\scripts\deploy-staging.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$src = Join-Path $root "deploy.staging.env"
if (-not (Test-Path $src)) {
  Write-Error "Нет deploy.staging.env в корне. Заполни по deploy.staging.env.example"
}

Copy-Item -Path $src -Destination (Join-Path $root "deploy.env") -Force
Write-Host "=== deploy.env скопирован из deploy.staging.env ==="

$bash = $null
foreach ($c in @(
  "${env:ProgramFiles}\Git\bin\bash.exe",
  "${env:ProgramFiles(x86)}\Git\bin\bash.exe",
  "C:\Program Files\Git\bin\bash.exe"
)) {
  if ($c -and (Test-Path $c)) { $bash = $c; break }
}
if (-not $bash) {
  Write-Error "Не найден Git Bash. Установи Git for Windows или зайди в WSL и выполни: bash scripts/deploy-staging-local.sh"
}

& $bash -lc "cd '$($root -replace '\\','/')' && bash scripts/deploy.sh"
