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

# ---- Check PostgreSQL ----
try {
    $null = Get-Command psql -ErrorAction Stop
    Write-Ok "PostgreSQL client (psql) found"
} catch {
    Write-Warn "PostgreSQL client (psql) not found on PATH."
    Write-Host ""
    Write-Host "  You need a PostgreSQL database. Options:" -ForegroundColor Yellow
    Write-Host "    1. Install PostgreSQL locally:" -ForegroundColor Yellow
    Write-Host "       Download from: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
    Write-Host "       Or: winget install PostgreSQL.PostgreSQL" -ForegroundColor Yellow
    Write-Host "    2. Use a free cloud database: https://neon.tech (no install needed)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  You can continue setup and configure DATABASE_URL in .env later."
    Write-Host ""
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
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/xrpl_monitor
SESSION_SECRET=change-me-to-a-random-string
"@ | Out-File -Encoding UTF8 ".env"
        Write-Ok "Created .env with defaults"
    }
    Write-Warn "Edit .env and set your DATABASE_URL before starting the app."
    Write-Host ""
    Write-Host "  Open it with:  notepad .env" -ForegroundColor Yellow
    Write-Host ""
}

# ---- Install dependencies ----
Write-Info "Installing npm dependencies..."
npm install
if ($LASTEXITCODE -ne 0) { Write-Fail "npm install failed"; exit 1 }
Write-Ok "Dependencies installed"

# ---- Push database schema ----
Write-Host ""
Write-Info "Checking database connection and pushing schema..."

$envContent = Get-Content ".env" -ErrorAction SilentlyContinue
$hasPlaceholder = $envContent | Where-Object { $_ -match "yourpassword" }

if ($hasPlaceholder) {
    Write-Warn "DATABASE_URL still has placeholder values in .env"
    Write-Warn "Skipping database setup - edit .env first, then run:  npm run db:push"
} else {
    foreach ($line in $envContent) {
        if ($line -match '^\s*#' -or $line -match '^\s*$') { continue }
        $parts = $line -split '=', 2
        if ($parts.Count -eq 2) {
            [System.Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), "Process")
        }
    }
    npm run db:push 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "Database schema pushed successfully"
    } else {
        Write-Warn "Database push failed. Make sure DATABASE_URL in .env is correct."
        Write-Warn "Once fixed, run:  npm run db:push"
    }
}

# ---- Done ----
Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "  Setup complete!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Next steps:"
Write-Host "    1. Edit .env and set your DATABASE_URL (if not done)"
Write-Host "       notepad .env"
Write-Host ""
Write-Host "    2. Start the app (from the project root):"
Write-Host ""
Write-Host "       .\scripts\start.ps1           # Development mode" -ForegroundColor Cyan
Write-Host "       .\scripts\start.ps1 -Prod     # Production mode" -ForegroundColor Cyan
Write-Host ""
Write-Host "    3. Open http://localhost:5000 in your browser"
Write-Host ""
