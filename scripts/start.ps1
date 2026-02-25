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

# ---- Navigate to project root ----
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Split-Path -Parent $scriptDir
Set-Location $projectDir

# ---- Load .env ----
if (-not (Test-Path ".env")) {
    Write-Host "[ERROR] .env file not found in $projectDir" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Run the install script first:" -ForegroundColor Yellow
    Write-Host "    .\scripts\install.ps1" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Or create .env manually:" -ForegroundColor Yellow
    Write-Host "    Copy-Item .env.example .env" -ForegroundColor Yellow
    Write-Host "    notepad .env" -ForegroundColor Yellow
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
    Write-Host "  Edit .env and add your PostgreSQL connection string." -ForegroundColor Yellow
    exit 1
}

if ($Prod) {
    Write-Host "[XRPL Monitor] Building for production..." -ForegroundColor Cyan
    npm run build
    if ($LASTEXITCODE -ne 0) { exit 1 }
    Write-Host "[XRPL Monitor] Starting production server..." -ForegroundColor Green
    npm start
} else {
    Write-Host "[XRPL Monitor] Starting development server on http://localhost:5000 ..." -ForegroundColor Green
    npm run dev
}
