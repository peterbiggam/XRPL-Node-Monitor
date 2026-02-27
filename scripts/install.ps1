# =============================================
#  XRPL Node Monitor — Install Script (Windows)
#  Run from the project root:  .\scripts\install.ps1
#  Or from the scripts folder: .\install.ps1
# =============================================

$ErrorActionPreference = "Stop"

function Write-Info  { Write-Host "[INFO]  " -ForegroundColor Cyan -NoNewline; Write-Host $args[0] }
function Write-Ok    { Write-Host "[OK]    " -ForegroundColor Green -NoNewline; Write-Host $args[0] }
function Write-Warn  { Write-Host "[WARN]  " -ForegroundColor Yellow -NoNewline; Write-Host $args[0] }
function Write-Fail  { Write-Host "[FAIL]  " -ForegroundColor Red -NoNewline; Write-Host $args[0] }

# ---- Navigate to project root ----
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Split-Path -Parent $scriptDir
Set-Location $projectDir
Write-Info "Project directory: $projectDir"

# ---- Unblock scripts so Windows stops showing security warnings ----
Get-ChildItem -Path "$scriptDir\*.ps1" | ForEach-Object {
    Unblock-File -Path $_.FullName -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  XRPL Node Monitor - Setup (Windows)" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# ---- Check Node.js ----
try {
    $nodeVersion = (node -v) -replace 'v', ''
    $nodeMajor = [int]($nodeVersion.Split('.')[0])
    if ($nodeMajor -ge 18) {
        Write-Ok "Node.js v$nodeVersion found"
    } else {
        Write-Fail "Node.js v$nodeVersion is too old. Version 18+ is required."
        Write-Host ""
        Write-Host "  Download from: https://nodejs.org" -ForegroundColor Yellow
        Write-Host "  Or with winget: winget install OpenJS.NodeJS.LTS" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Fail "Node.js is not installed."
    Write-Host ""
    Write-Host "  Download from: https://nodejs.org" -ForegroundColor Yellow
    Write-Host "  Or with winget: winget install OpenJS.NodeJS.LTS" -ForegroundColor Yellow
    exit 1
}

# ---- Check npm ----
try {
    $npmVersion = npm -v
    Write-Ok "npm v$npmVersion found"
} catch {
    Write-Fail "npm is not installed. It usually comes with Node.js."
    exit 1
}

# ---- Set up .env ----
if (Test-Path ".env") {
    Write-Ok ".env file already exists"
} else {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Ok "Created .env from .env.example"
    } else {
        Write-Warn ".env.example not found - creating minimal .env"
        @"
SESSION_SECRET=change-me-to-a-random-string
"@ | Out-File -Encoding UTF8 ".env"
        Write-Ok "Created .env with defaults"
    }
    Write-Warn "Edit .env and set SESSION_SECRET to a random string."
    Write-Host ""
    Write-Host "  Open it with:  notepad .env" -ForegroundColor Yellow
    Write-Host ""
}

# ---- Install dependencies ----
Write-Info "Installing npm dependencies..."
npm install
if ($LASTEXITCODE -ne 0) { Write-Fail "npm install failed"; exit 1 }
Write-Ok "Dependencies installed"

# ---- Create data directory ----
if (-not (Test-Path "data")) { New-Item -ItemType Directory -Path "data" | Out-Null }
Write-Ok "Data directory ready (SQLite database will be created at ./data/xrpl-monitor.db)"

# ---- Done ----
Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "  Setup complete!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Next steps:"
Write-Host "    1. Start the app (from the project root):"
Write-Host ""
Write-Host "       .\scripts\start.ps1           # Development mode" -ForegroundColor Cyan
Write-Host "       .\scripts\start.ps1 -Prod     # Production mode" -ForegroundColor Cyan
Write-Host ""
Write-Host "    2. Open http://localhost:5000 in your browser"
Write-Host ""
