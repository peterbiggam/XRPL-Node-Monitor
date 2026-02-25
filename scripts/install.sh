#!/usr/bin/env bash
set -e

# =============================================
#  XRPL Node Monitor — Install Script
#  Supports: Linux (Debian/Ubuntu/Fedora) & macOS
# =============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC}  $1"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
fail()  { echo -e "${RED}[FAIL]${NC}  $1"; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   XRPL Node Monitor — Setup              ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""

OS="unknown"
if [[ "$OSTYPE" == "darwin"* ]]; then
  OS="macos"
elif [[ -f /etc/debian_version ]]; then
  OS="debian"
elif [[ -f /etc/fedora-release ]]; then
  OS="fedora"
elif [[ -f /etc/os-release ]]; then
  OS="linux"
fi
info "Detected platform: $OS"

# ---- Check Node.js ----
if command -v node &> /dev/null; then
  NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VER" -ge 18 ]; then
    ok "Node.js $(node -v) found"
  else
    fail "Node.js $(node -v) is too old. Version 18 or newer is required."
    echo ""
    echo "  Install the latest LTS from: https://nodejs.org"
    if [[ "$OS" == "macos" ]]; then
      echo "  Or run:  brew install node"
    elif [[ "$OS" == "debian" ]]; then
      echo "  Or run:  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
    elif [[ "$OS" == "fedora" ]]; then
      echo "  Or run:  sudo dnf install -y nodejs"
    fi
    exit 1
  fi
else
  fail "Node.js is not installed."
  echo ""
  echo "  Install Node.js 18+ from: https://nodejs.org"
  if [[ "$OS" == "macos" ]]; then
    echo "  Or run:  brew install node"
  elif [[ "$OS" == "debian" ]]; then
    echo "  Or run:  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
  elif [[ "$OS" == "fedora" ]]; then
    echo "  Or run:  sudo dnf install -y nodejs"
  fi
  exit 1
fi

# ---- Check npm ----
if command -v npm &> /dev/null; then
  ok "npm $(npm -v) found"
else
  fail "npm is not installed. It usually comes with Node.js."
  exit 1
fi

# ---- Check PostgreSQL ----
if command -v psql &> /dev/null; then
  ok "PostgreSQL client (psql) found"
else
  warn "PostgreSQL client (psql) not found on PATH."
  echo ""
  echo "  You need a PostgreSQL database. Options:"
  echo "    1. Install PostgreSQL locally:"
  if [[ "$OS" == "macos" ]]; then
    echo "       brew install postgresql@16 && brew services start postgresql@16"
  elif [[ "$OS" == "debian" ]]; then
    echo "       sudo apt-get install -y postgresql postgresql-client"
  elif [[ "$OS" == "fedora" ]]; then
    echo "       sudo dnf install -y postgresql-server postgresql && sudo postgresql-setup --initdb && sudo systemctl start postgresql"
  fi
  echo "    2. Use a free cloud database: https://neon.tech (no install needed)"
  echo ""
  echo "  You can continue setup and configure DATABASE_URL in .env later."
  echo ""
fi

# ---- Set up .env ----
if [ -f .env ]; then
  ok ".env file already exists"
else
  if [ -f .env.example ]; then
    cp .env.example .env
    ok "Created .env from .env.example"
  else
    warn ".env.example not found — creating minimal .env"
    cat > .env << 'ENVEOF'
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/xrpl_monitor
SESSION_SECRET=change-me-to-a-random-string
ENVEOF
    ok "Created .env with defaults"
  fi
  warn "Edit .env and set your DATABASE_URL before starting the app."
  echo ""
  echo "  Open it with:  nano .env"
  echo ""
fi

# ---- Install dependencies ----
info "Installing npm dependencies..."
npm install
ok "Dependencies installed"

# ---- Push database schema ----
echo ""
info "Checking database connection and pushing schema..."

if grep -q "yourpassword" .env 2>/dev/null; then
  warn "DATABASE_URL still has placeholder values in .env"
  warn "Skipping database setup — edit .env first, then run:  npm run db:push"
else
  set +e
  eval "$(node -e "
    const fs = require('fs');
    const lines = fs.readFileSync('.env', 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.substring(0, eq).trim();
      const val = trimmed.substring(eq + 1).trim();
      console.log('export ' + key + '=' + JSON.stringify(val));
    }
  ")"
  npm run db:push 2>&1
  DB_EXIT=$?
  set -e
  if [ $DB_EXIT -eq 0 ]; then
    ok "Database schema pushed successfully"
  else
    warn "Database push failed. Make sure DATABASE_URL in .env is correct."
    warn "Once fixed, run:  npm run db:push"
  fi
fi

# ---- Done ----
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Setup complete!                         ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo "  Next steps:"
echo "    1. Edit .env and set your DATABASE_URL (if not done)"
echo "    2. Start the app:"
echo ""
echo "       ./scripts/start.sh           # Development mode"
echo "       ./scripts/start.sh --prod    # Production mode"
echo ""
echo "    3. Open http://localhost:5000 in your browser"
echo ""
