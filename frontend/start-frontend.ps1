#Requires -Version 5.1
<#
.SYNOPSIS
    Start only the Egg Drop React/Vite frontend.

.EXAMPLE
    .\start-frontend.ps1

.EXAMPLE
    .\start-frontend.ps1 -Port 5174
#>

[CmdletBinding()]
param(
    [int]$Port = 5173
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$FrontendDir = $PSScriptRoot

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] npm not found. Install Node.js from https://nodejs.org" -ForegroundColor Red
    exit 1
}

$modules = Join-Path $FrontendDir 'node_modules'
if (-not (Test-Path $modules)) {
    Write-Host "node_modules not found — running npm install..." -ForegroundColor Yellow
    Push-Location $FrontendDir
    & npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] npm install failed." -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Pop-Location
}

Write-Host "Starting frontend on http://localhost:$Port  (Ctrl+C to stop)" -ForegroundColor Cyan
Push-Location $FrontendDir
try {
    & npm run dev -- --port $Port
} finally {
    Pop-Location
}
