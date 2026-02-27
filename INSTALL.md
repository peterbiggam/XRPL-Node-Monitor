# XRPL Node Monitor — Installation Guide

## Docker (Easiest — Recommended)

Docker handles everything for you — the app and all dependencies in one command. No database setup needed — SQLite is built in.

### Prerequisites

Install Docker Desktop:
- **Windows**: [Download Docker Desktop](https://www.docker.com/products/docker-desktop/) or `winget install Docker.DockerDesktop`
- **macOS**: [Download Docker Desktop](https://www.docker.com/products/docker-desktop/) or `brew install --cask docker`
- **Linux**: [Install Docker Engine](https://docs.docker.com/engine/install/)

### Run It

```bash
git clone <your-repo-url> xrpl-monitor
cd xrpl-monitor
docker compose up -d
```

That's it. Open **http://localhost:5000** in your browser.

The first run takes a minute or two to build. After that it starts in seconds.

### Docker Commands

```bash
docker compose up -d        # Start in background
docker compose down          # Stop
docker compose logs -f app   # View app logs
docker compose up -d --build # Rebuild after code changes
```

### Connecting to Your XRPL Node

The monitor needs to know where your XRPL node is. Edit the environment variables in `docker-compose.yml` before running `docker compose up`:

**If your XRPL node runs directly on your PC (or in another Docker container with host networking):**
```yaml
XRPL_HOST: host.docker.internal
XRPL_WS_PORT: "6006"
XRPL_ADMIN_PORT: "8080"
```
`host.docker.internal` is a special Docker address that points back to your PC. This is the default.

**If your XRPL node runs in its own Docker container:**
You can either:
1. Put both containers on the same Docker network — use the XRPL container name as the host:
   ```yaml
   XRPL_HOST: my-xrpl-node
   ```
   And add to the `app` service:
   ```yaml
   networks:
     - default
     - xrpl-network    # whatever network your node uses
   ```
2. Or if your XRPL node exposes ports to the host, just use `host.docker.internal` (the default).

**Common XRPL node ports:**
| Port | Purpose |
|------|---------|
| `6006` | WebSocket (peer protocol) |
| `5005` | JSON-RPC / HTTP |
| `8080` | Admin WebSocket |
| `51235` | Peer protocol |

You can also change these later in the app's Settings page without restarting Docker.

### Connecting LM Studio for AI Analysis

If you run [LM Studio](https://lmstudio.ai/) on your PC, uncomment the `LM_STUDIO_URL` line in `docker-compose.yml`:

```yaml
LM_STUDIO_URL: http://host.docker.internal:1234
```

Make sure LM Studio's local server is running (start it from within LM Studio). The monitor will auto-configure the AI connection on first startup.

### Data Persistence

The SQLite database is stored in a Docker volume (`appdata`), so your data persists across restarts and rebuilds.

To back up the database:
```bash
docker cp $(docker compose ps -q app):/app/data/xrpl-monitor.db ./backup.db
```

---

## Script Install (Without Docker)

If you prefer running directly on your machine without Docker.

### Prerequisites

1. **Node.js** (version 18 or newer) — [Download here](https://nodejs.org)

That's all you need. The app uses SQLite, which is bundled automatically — no separate database install required.

#### Installing Node.js

| Platform | Command |
|----------|---------|
| **Windows** | `winget install OpenJS.NodeJS.LTS` or download from [nodejs.org](https://nodejs.org) |
| **macOS** | `brew install node` or download from [nodejs.org](https://nodejs.org) |
| **Ubuntu/Debian** | `curl -fsSL https://deb.nodesource.com/setup_20.x \| sudo -E bash - && sudo apt-get install -y nodejs` |
| **Fedora** | `sudo dnf install -y nodejs` |

### Quick Start

#### Linux / macOS

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

#### Windows (PowerShell)

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
   SESSION_SECRET=any-random-string-here
   ```

4. **Start the app:**
   ```bash
   npm run dev
   ```

5. Open **http://localhost:5000** in your browser.

The SQLite database is automatically created at `./data/xrpl-monitor.db` on first run.

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SESSION_SECRET` | Yes | — | Random string for session encryption |
| `DATABASE_PATH` | No | `./data/xrpl-monitor.db` | Path to SQLite database file |
| `PORT` | No | `5000` | Port the server runs on |

### Connecting to Your XRPL Node

Once the app is running, go to **Settings** in the sidebar and enter your XRPL node's connection details:

- **Host**: IP address or hostname of your XRPL node (e.g., `127.0.0.1` or `my-node.example.com`)
- **WebSocket Port**: Usually `6006` (or `51233` for public nodes)
- **Admin Port**: Usually `5005`

If you don't have your own node, you can monitor public nodes like `s2.ripple.com` (WebSocket port `51233`).

---

## Running in Production

### With Docker (recommended)
Docker Compose already runs in production mode by default.

### Without Docker

**Linux / macOS:**
```bash
./scripts/start.sh --prod
```

**Windows:**
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start.ps1 -Prod
```

**Or manually:**
```bash
npm run build
npm start
```

---

## Troubleshooting

### Docker: "port is already allocated"
Another service is using port 5000. Either stop that service or change the ports in `docker-compose.yml`:
```yaml
ports:
  - "3000:5000"   # Use port 3000 instead
```

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
- If running in Docker and connecting to a node on the same machine, use `host.docker.internal` instead of `127.0.0.1` as the host
