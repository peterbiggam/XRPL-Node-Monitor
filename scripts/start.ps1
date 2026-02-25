# =============================================
#  XRPL Node Monitor — Start Script (Windows)
#  Usage:
#    .\scripts\start.ps1           # Development mode
#    .\scripts\start.ps1 -Prod     # Production mode
# =============================================

param(
    [switch]$Prod
)

$ErrorActionPreference = "Stop"

$projectDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $projectDir

if (-not (Test-Path ".env")) {
    Write-Host "[ERROR] .env file not found. Run the install script first:" -ForegroundColor Red
    Write-Host "  .\scripts\install.ps1" -ForegroundColor Yellow
    exit 1
}

$envContent = Get-Content ".env"
foreach ($line in $envContent) {
    if ($line -match '^\s*#' -or $line -match '^\s*$') { continue }
    $parts = $line -split '=', 2
    if ($parts.Count -eq 2) {
        [System.Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), "Process")
    }
}

if (-not $env:DATABASE_URL) {
    Write-Host "[ERROR] DATABASE_URL is not set in .env" -ForegroundColor Red
    exit 1
}

if ($Prod) {
    Write-Host "[XRPL Monitor] Building for production..." -ForegroundColor Cyan
    npm run build
    if ($LASTEXITCODE -ne 0) { exit 1 }
    Write-Host "[XRPL Monitor] Starting production server..." -ForegroundColor Green
    npm start
} else {
    Write-Host "[XRPL Monitor] Starting development server..." -ForegroundColor Green
    npm run dev
}
