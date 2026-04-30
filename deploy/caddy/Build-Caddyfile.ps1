param(
  [string]$TemplatePath = (Join-Path $PSScriptRoot 'Caddyfile.template'),
  [string]$TargetPath = 'C:\Caddy\Caddyfile'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $TemplatePath)) {
  throw "Template not found: $TemplatePath"
}

$targetDir = Split-Path -Parent $TargetPath
if (-not (Test-Path -LiteralPath $targetDir)) {
  New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

Copy-Item -LiteralPath $TemplatePath -Destination $TargetPath -Force
Write-Output "Wrote Caddy config: $TargetPath"

