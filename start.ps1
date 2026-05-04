#Requires -Version 5.1
<#
.SYNOPSIS
    Start the Egg Drop Simulator (backend + frontend).

.DESCRIPTION
    Launches the FastAPI physics backend (uvicorn) and the Vite/React
    frontend as two background jobs, then tails their combined output
    until you press Ctrl+C, at which point both processes are stopped.

.EXAMPLE
    .\start.ps1

.EXAMPLE
    .\start.ps1 -BackendPort 8001 -FrontendPort 5174
#>

[CmdletBinding()]
param(
    [int]$BackendPort  = 8000,
    [int]$FrontendPort = 5173
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root     = $PSScriptRoot
$Backend  = Join-Path $Root 'backend'
$Frontend = Join-Path $Root 'frontend'

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-Host "  $Text" -ForegroundColor Cyan
}

function Assert-Command {
    param([string]$Name, [string]$InstallHint)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        Write-Host "  [ERROR] '$Name' not found on PATH." -ForegroundColor Red
        Write-Host "          $InstallHint" -ForegroundColor Yellow
        exit 1
    }
}

# ---------------------------------------------------------------------------
# Banner
# ---------------------------------------------------------------------------
Clear-Host
Write-Host ""
Write-Host "  ==========================================" -ForegroundColor DarkCyan
Write-Host "   EGG DROP SIMULATOR  --  2D Physics" -ForegroundColor Cyan
Write-Host "  ==========================================" -ForegroundColor DarkCyan
Write-Host ""

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
Write-Header "Checking prerequisites..."

Assert-Command 'python'  'Install Python 3.9+ from https://python.org'
Assert-Command 'uvicorn' 'Run: pip install uvicorn'
Assert-Command 'node'    'Install Node.js 18+ from https://nodejs.org'
Assert-Command 'npm'     'npm ships with Node.js'

$pyVer  = & python --version 2>&1
$nodeVer = & node --version 2>&1
Write-Host "  Python : $pyVer" -ForegroundColor Green
Write-Host "  Node   : $nodeVer" -ForegroundColor Green

# ---------------------------------------------------------------------------
# Install frontend dependencies if node_modules is missing
# ---------------------------------------------------------------------------
$modules = Join-Path $Frontend 'node_modules'
if (-not (Test-Path $modules)) {
    Write-Header "Installing frontend npm dependencies..."
    Push-Location $Frontend
    & npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [ERROR] npm install failed." -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Pop-Location
}

# ---------------------------------------------------------------------------
# Start backend job
# ---------------------------------------------------------------------------
Write-Header "Starting physics backend (FastAPI + Pymunk)..."

$backendJob = Start-Job -Name 'EggBackend' -ScriptBlock {
    param($dir, $port)
    Set-Location $dir
    & uvicorn main:app --host 0.0.0.0 --port $port --reload 2>&1
} -ArgumentList $Backend, $BackendPort

# ---------------------------------------------------------------------------
# Start frontend job
# ---------------------------------------------------------------------------
Write-Header "Starting frontend (Vite + React)..."

$frontendJob = Start-Job -Name 'EggFrontend' -ScriptBlock {
    param($dir, $port)
    Set-Location $dir
    & npm run dev -- --port $port 2>&1
} -ArgumentList $Frontend, $FrontendPort

# ---------------------------------------------------------------------------
# Wait briefly then print URLs
# ---------------------------------------------------------------------------
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "  ------------------------------------------" -ForegroundColor DarkGray
Write-Host "   Backend  -> http://localhost:$BackendPort" -ForegroundColor White
Write-Host "   Frontend -> http://localhost:$FrontendPort" -ForegroundColor White
Write-Host "  ------------------------------------------" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Press Ctrl+C to stop both servers." -ForegroundColor Yellow
Write-Host ""

# ---------------------------------------------------------------------------
# Tail output from both jobs until Ctrl+C
# ---------------------------------------------------------------------------
$colors = @{
    'EggBackend'  = 'Blue'
    'EggFrontend' = 'Magenta'
}

try {
    while ($true) {
        foreach ($job in @($backendJob, $frontendJob)) {
            $lines = Receive-Job -Job $job -ErrorAction SilentlyContinue
            if ($lines) {
                $col = $colors[$job.Name]
                $prefix = if ($job.Name -eq 'EggBackend') { '[backend ]' } else { '[frontend]' }
                foreach ($line in $lines) {
                    Write-Host "$prefix $line" -ForegroundColor $col
                }
            }

            # Restart a job that died unexpectedly
            if ($job.State -eq 'Failed') {
                Write-Host "  [WARN] $($job.Name) exited — check output above." -ForegroundColor Red
            }
        }
        Start-Sleep -Milliseconds 300
    }
}
finally {
    # ---------------------------------------------------------------------------
    # Cleanup on Ctrl+C or any exit
    # ---------------------------------------------------------------------------
    Write-Host ""
    Write-Host "  Stopping servers..." -ForegroundColor Yellow

    Stop-Job  -Job $backendJob,  $frontendJob -ErrorAction SilentlyContinue
    Remove-Job -Job $backendJob, $frontendJob -Force -ErrorAction SilentlyContinue

    Write-Host "  Done. Goodbye!" -ForegroundColor Cyan
    Write-Host ""
}
