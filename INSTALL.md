# XRPL Node Monitor — Installation Guide

## Prerequisites

You need two things installed on your machine:

1. **Node.js** (version 18 or newer) — [Download here](https://nodejs.org)
2. **PostgreSQL** database — either installed locally or a free cloud database

### Installing Node.js

| Platform | Command |
|----------|---------|
| **Windows** | `winget install OpenJS.NodeJS.LTS` or download from [nodejs.org](https://nodejs.org) |
| **macOS** | `brew install node` or download from [nodejs.org](https://nodejs.org) |
| **Ubuntu/Debian** | `curl -fsSL https://deb.nodesource.com/setup_20.x \| sudo -E bash - && sudo apt-get install -y nodejs` |
| **Fedora** | `sudo dnf install -y nodejs` |

### Setting Up PostgreSQL

**Option A — Local install:**

| Platform | Command |
|----------|---------|
| **Windows** | `winget install PostgreSQL.PostgreSQL` or download from [postgresql.org](https://www.postgresql.org/download/windows/) |
| **macOS** | `brew install postgresql@16 && brew services start postgresql@16` |
| **Ubuntu/Debian** | `sudo apt-get install -y postgresql postgresql-client` |
| **Fedora** | `sudo dnf install -y postgresql-server postgresql` then `sudo postgresql-setup --initdb && sudo systemctl start postgresql` |

After installing, create a database:
```
psql -U postgres -c "CREATE DATABASE xrpl_monitor;"
```

**Option B — Free cloud database (no install needed):**

Sign up at [neon.tech](https://neon.tech) and create a free PostgreSQL database. Copy the connection string they provide.

---

## Quick Start (Recommended)

### Linux / macOS

```bash
git clone <your-repo-url> xrpl-monitor
cd xrpl-monitor
./scripts/install.sh
```

The script will check your setup, install dependencies, and guide you through configuration.

Then start the app:
```bash
./scripts/start.sh
```

### Windows (PowerShell)

```powershell
git clone <your-repo-url> xrpl-monitor
cd xrpl-monitor
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1
```

Then start the app:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start.ps1
```

Open **http://localhost:5000** in your browser.

---

## Manual Setup

If you prefer to set things up manually:

1. **Clone and install dependencies:**
   ```bash
   git clone <your-repo-url> xrpl-monitor
   cd xrpl-monitor
   npm install
   ```

2. **Create your environment file:**
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env`** and set your values:
   ```
   DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/xrpl_monitor
   SESSION_SECRET=any-random-string-here
   ```

4. **Initialize the database:**
   ```bash
   npm run db:push
   ```

5. **Start the app:**
   ```bash
   npm run dev
   ```

6. Open **http://localhost:5000** in your browser.

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | — | Random string for session encryption |
| `PORT` | No | `5000` | Port the server runs on |

### Connecting to Your XRPL Node

Once the app is running, go to **Settings** in the sidebar and enter your XRPL node's connection details:

- **Host**: IP address or hostname of your XRPL node (e.g., `127.0.0.1` or `my-node.example.com`)
- **WebSocket Port**: Usually `6006` (or `51233` for public nodes)
- **Admin Port**: Usually `5005`

If you don't have your own node, you can monitor public nodes like `s2.ripple.com` (WebSocket port `51233`).

---

## Running in Production

To build and run an optimized production build:

**Linux / macOS:**
```bash
./scripts/start.sh --prod
```

**Windows:**
```powershell
.\scripts\start.ps1 -Prod
```

**Or manually:**
```bash
npm run build
npm start
```

---

## Troubleshooting

### "DATABASE_URL, ensure the database is provisioned"
Your `DATABASE_URL` environment variable is not set or the `.env` file is missing. Make sure you've created `.env` with a valid PostgreSQL connection string.

### "npm run db:push" fails
- Verify PostgreSQL is running: `psql -U postgres -c "SELECT 1;"`
- Check that the database exists: `psql -U postgres -c "\l"` and look for your database name
- Verify your `DATABASE_URL` is correct in `.env`

### Port 5000 is already in use
Set a different port in `.env`:
```
PORT=3000
```

### Node.js version errors
Check your version with `node -v`. You need version 18 or newer. If you have an older version, download the latest LTS from [nodejs.org](https://nodejs.org).

### Cannot connect to XRPL node
- Make sure your node is running and accessible from this machine
- Check that the WebSocket port is open (default: `6006`)
- Try connecting to a public node first (`s2.ripple.com` port `51233`) to verify the app works
