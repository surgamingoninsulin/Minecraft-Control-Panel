$ErrorActionPreference = 'SilentlyContinue'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path.ToLowerInvariant()
$ports = @(8080, 5173, 443)
$killIds = [System.Collections.Generic.HashSet[int]]::new()

foreach ($port in $ports) {
  Get-NetTCPConnection -State Listen -LocalPort $port | ForEach-Object {
    [void]$killIds.Add([int]$_.OwningProcess)
  }
}

$procs = Get-CimInstance Win32_Process
$targets = $procs | Where-Object {
  ($_.Name -in @('node.exe', 'npm.exe', 'caddy.exe', 'wscript.exe', 'cscript.exe')) -and
  (-not [string]::IsNullOrWhiteSpace($_.CommandLine)) -and
  (
    $_.CommandLine.ToLowerInvariant().Contains($root) -or
    $_.CommandLine -match 'start\.vbs' -or
    $_.CommandLine -match 'deploy\\caddy\\Caddyfile\.template'
  )
}

foreach ($p in $targets) {
  [void]$killIds.Add([int]$p.ProcessId)
}

foreach ($id in $killIds) {
  try {
    Stop-Process -Id $id -Force -ErrorAction Stop
  } catch {
    # best-effort
  }
}

Write-Output ("Stopped process IDs: " + (($killIds | Sort-Object) -join ', '))
