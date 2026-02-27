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
SESSION_SECRET=change-me-to-a-random-string
ENVEOF
    ok "Created .env with defaults"
  fi
  warn "Edit .env and set SESSION_SECRET to a random string."
  echo ""
  echo "  Open it with:  nano .env"
  echo ""
fi

# ---- Install dependencies ----
info "Installing npm dependencies..."
npm install
ok "Dependencies installed"

# ---- Create data directory ----
mkdir -p data
ok "Data directory ready (SQLite database will be created at ./data/xrpl-monitor.db)"

# ---- Done ----
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Setup complete!                         ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo "  Next steps:"
echo "    1. Start the app:"
echo ""
echo "       ./scripts/start.sh           # Development mode"
echo "       ./scripts/start.sh --prod    # Production mode"
echo ""
echo "    2. Open http://localhost:5000 in your browser"
echo ""
