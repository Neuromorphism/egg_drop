#Requires -Version 5.1
<#
.SYNOPSIS
    Start only the Egg Drop physics backend.

.EXAMPLE
    .\start-backend.ps1

.EXAMPLE
    .\start-backend.ps1 -Port 8001 -NoReload
#>

[CmdletBinding()]
param(
    [int]   $Port     = 8000,
    [switch]$NoReload
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$BackendDir = $PSScriptRoot

if (-not (Get-Command uvicorn -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] uvicorn not found. Run: pip install -r requirements.txt" -ForegroundColor Red
    exit 1
}

$reloadFlag = if ($NoReload) { @() } else { @('--reload') }

Write-Host "Starting backend on http://localhost:$Port  (Ctrl+C to stop)" -ForegroundColor Cyan
Push-Location $BackendDir
try {
    & uvicorn main:app --host 0.0.0.0 --port $Port @reloadFlag
} finally {
    Pop-Location
}
