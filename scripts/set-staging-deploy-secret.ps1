# Читает deploy.staging.env и создаёт секрет STAGING_DEPLOY_ENV в GitHub (нужен gh CLI).
# Установка gh: https://cli.github.com/
# Запуск из корня репозитория: .\scripts\set-staging-deploy-secret.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$envFile = Join-Path $root "deploy.staging.env"
if (-not (Test-Path $envFile)) {
  Write-Error "Нет файла deploy.staging.env в корне проекта. Скопируй deploy.staging.env.example и заполни."
}

$gh = Get-Command gh -ErrorAction SilentlyContinue
if (-not $gh) {
  Write-Error "Нет команды gh. Установи GitHub CLI: https://cli.github.com/ затем: gh auth login"
}

$remote = (git remote get-url origin 2>$null)
if (-not $remote) {
  Write-Error "Нет git remote origin"
}
if ($remote -match "github\.com[:/]([^/]+/[^/.]+)") {
  $repo = $Matches[1]
} else {
  Write-Error "Не удалось разобрать owner/repo из: $remote"
}

$body = Get-Content -Raw -Encoding UTF8 $envFile
if ([string]::IsNullOrWhiteSpace($body)) {
  Write-Error "Файл deploy.staging.env пустой"
}

Write-Host "Репозиторий: $repo"
Write-Host "Секрет: STAGING_DEPLOY_ENV (из deploy.staging.env)"
$body | gh secret set STAGING_DEPLOY_ENV --repo $repo
Write-Host "Готово. Запусти Actions → Deploy staging или сделай push в feature/dev."
