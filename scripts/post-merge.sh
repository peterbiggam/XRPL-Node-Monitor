#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Install the exact locked dependencies, including development build tools.
npm ci --include=dev --no-audit --no-fund

# SQLite tables are initialized by the application on startup. Do not run
# interactive schema pushes or reset the existing database during merges.
npm run build
