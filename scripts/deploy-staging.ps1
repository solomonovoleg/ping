$ErrorActionPreference = "Stop"

Set-Location (Join-Path $PSScriptRoot "..")

function Read-EnvFile {
  param([string]$Path)
  $map = @{}
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim().TrimStart([char]0xFEFF)
    if (-not $line) { return }
    if ($line.StartsWith("#")) { return }
    if ($line.StartsWith("export ")) { $line = $line.Substring(7) }
    $idx = $line.IndexOf("=")
    if ($idx -lt 1) { return }
    $k = $line.Substring(0, $idx).Trim()
    $v = $line.Substring($idx + 1).Trim()
    if (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'"))) {
      $v = $v.Substring(1, $v.Length - 2)
    }
    $map[$k] = $v
  }
  return $map
}

function Require-Value {
  param([hashtable]$EnvMap, [string]$Key)
  if (-not $EnvMap.ContainsKey($Key) -or [string]::IsNullOrWhiteSpace($EnvMap[$Key])) {
    throw "Missing required value '$Key' in deploy.staging.env"
  }
}

$deployEnvPath = Join-Path (Get-Location) "deploy.staging.env"
if (-not (Test-Path $deployEnvPath)) {
  $example = Join-Path (Get-Location) "deploy.staging.env.example"
  if (Test-Path $example) {
    Copy-Item $example $deployEnvPath
    Write-Host "Created deploy.staging.env from example. Fill required values and rerun."
    exit 1
  }
  throw "deploy.staging.env not found"
}

$envMap = Read-EnvFile -Path $deployEnvPath
Require-Value $envMap "VPS_HOST"
Require-Value $envMap "VPS_USER"
Require-Value $envMap "VPS_PASSWORD"
Require-Value $envMap "DATABASE_URL"

$serverHost = $envMap["VPS_HOST"]
$serverUser = $envMap["VPS_USER"]
$remoteDir = if ($envMap["VPS_PATH"]) { $envMap["VPS_PATH"] } else { "/var/www/ping-moot-staging" }
$remotePort = if ($envMap["PORT"]) { $envMap["PORT"] } else { "3081" }
$appName = if ($envMap["APP_NAME"]) { $envMap["APP_NAME"] } else { "ping-moot-staging" }

$remote = "$serverUser@$serverHost"
$tmpTar = Join-Path (Get-Location) ".deploy-staging.tar"
$tmpServerEnv = Join-Path (Get-Location) ".deploy-staging.server.env"
$remoteTar = "$remoteDir/.deploy-staging.tar"

Write-Host "== Build local artifacts =="
npm install --legacy-peer-deps
if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }

Write-Host "== Pack repository =="
if (Test-Path $tmpTar) { Remove-Item $tmpTar -Force }
tar --exclude node_modules --exclude .git --exclude .env --exclude uploads --exclude .deploy-staging.tar -cf $tmpTar .
if ($LASTEXITCODE -ne 0) { throw "tar pack failed" }

Write-Host "== Prepare server .env payload =="
$lines = @()
function Add-Kv([string]$k) {
  if ($envMap.ContainsKey($k) -and -not [string]::IsNullOrWhiteSpace($envMap[$k])) {
    # Trim + strip accidental surrounding quotes (иначе в URL БД попадает лишняя " → ping_moot_staging"")
    $v = $envMap[$k].Trim().Trim([char]0xFEFF)
    while ($v.Length -ge 2 -and $v.StartsWith('"') -and $v.EndsWith('"')) {
      $v = $v.Substring(1, $v.Length - 2).Trim()
    }
    $v = $v.TrimEnd("`r", "`n", " ", "`t")
    if ($k -eq "DATABASE_URL") { $v = $v.TrimEnd('"') }
    $escaped = $v.Replace("\", "\\").Replace('"', '\"')
    $script:lines += "$k=""$escaped"""
  }
}
Add-Kv "PORT"
if (-not ($envMap.ContainsKey("PORT")) -or [string]::IsNullOrWhiteSpace($envMap["PORT"])) {
  $lines += "PORT=""$remotePort"""
}
Add-Kv "SESSION_SECRET"
Add-Kv "SESSION_SECURE"
Add-Kv "DATABASE_URL"
Add-Kv "ADMIN_LOGIN"
Add-Kv "ADMIN_PASSWORD"
Add-Kv "FCM_SERVER_KEY"
Add-Kv "OPENROUTER_API_KEY"
Add-Kv "OPENROUTER_MODEL"
Add-Kv "S3_ENDPOINT"
Add-Kv "S3_BUCKET"
Add-Kv "S3_REGION"
Add-Kv "S3_ACCESS_KEY"
Add-Kv "S3_SECRET_KEY"
Add-Kv "S3_PUBLIC_ACL"
# UTF-8 без BOM — иначе на Linux в первой строке .env может остаться BOM и ломать парсинг
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllLines($tmpServerEnv, $lines, $utf8NoBom)

Write-Host "== Upload + remote setup (non-interactive, password from deploy.staging.env) =="
node scripts/deploy-staging-upload.mjs $tmpTar $tmpServerEnv
if ($LASTEXITCODE -ne 0) { throw "deploy-staging-upload failed" }

Write-Host ""
Write-Host "Staging deployed successfully."
Write-Host "Expected URL: http://$serverHost`:$remotePort"

if (Test-Path $tmpTar) { Remove-Item $tmpTar -Force }
if (Test-Path $tmpServerEnv) { Remove-Item $tmpServerEnv -Force }
