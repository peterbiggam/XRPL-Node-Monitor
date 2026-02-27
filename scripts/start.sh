#!/usr/bin/env bash
set -e

# =============================================
#  XRPL Node Monitor — Start Script
#  Usage:
#    ./scripts/start.sh           # Development mode
#    ./scripts/start.sh --prod    # Production mode
# =============================================

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

if [ ! -f .env ]; then
  echo -e "${RED}[ERROR]${NC} .env file not found. Run the install script first:"
  echo "  ./scripts/install.sh"
  exit 1
fi

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

if [[ "$1" == "--prod" || "$1" == "--production" ]]; then
  echo -e "${CYAN}[XRPL Monitor]${NC} Building for production..."
  npm run build
  echo -e "${GREEN}[XRPL Monitor]${NC} Starting production server..."
  npm start
else
  echo -e "${GREEN}[XRPL Monitor]${NC} Starting development server..."
  npm run dev
fi
