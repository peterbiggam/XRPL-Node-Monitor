<p align="center">
  <img src="client/public/favicon.png" alt="XRPL Node Monitor" width="64" />
</p>

<h1 align="center">XRPL Node Monitor</h1>

<p align="center">
  A real-time monitoring dashboard for XRP Ledger nodes with a cyberpunk command-center aesthetic.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20+-339933?logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/XRPL-Mainnet%20%7C%20Testnet-00AAE4" alt="XRPL" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License" />
</p>

---

## Overview

XRPL Node Monitor provides comprehensive, real-time insight into your XRP Ledger node's health, performance, and network status. It features persistent metrics history, configurable alerting with webhook notifications, AI-powered analysis via LM Studio, multi-node management, and a rich set of network exploration tools — all wrapped in a sci-fi HUD interface.

## Features

- **Live Dashboard** — Health score gauge (0-100), TPS, ledger lag, peer count, load factor, and server state at a glance
- **Metrics History** — Time-series charts (1h / 6h / 24h / 7d) for CPU, memory, peers, close times, latency, TPS, base fee, and a latency heatmap; CSV/JSON export
- **Alert Center** — Threshold-based warnings and critical alerts with cooldown logic, acknowledgement flow, and webhook dispatch
- **Network Explorer** — Transaction hash lookup, account info & balance, fee estimator
- **Ledger Explorer** — Detailed ledger info, recent ledger list, close-time chart
- **Peers** — Connected peers table, force-directed network graph, and geolocation world map
- **Live Transactions** — Real-time transaction feed with type-distribution chart
- **Validators & Amendments** — Validator list, amendment progress tracking, UNL overlap comparison with vl.ripple.com
- **AI Analysis** — LM Studio integration with SSE streaming chat, context-aware prompts, and conversation history
- **System Health** — CPU/memory gauges, disk usage, network I/O, OS info
- **Multi-Node Management** — Add, edit, delete, and switch between multiple XRPL nodes
- **Node Comparison** — Side-by-side live status comparison across all saved nodes
- **Webhook Notifications** — Discord, Telegram, or generic HTTP webhooks triggered by alerts
- **Keyboard Shortcuts** — Fast navigation with `g + key` combos, fullscreen toggle, and help modal
- **Sound Effects** — Web Audio API synthesized sounds for alerts and connections (toggleable)
- **Dark / Light Theme** — Cyberpunk dark mode by default with a light mode toggle

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, Shadcn/ui, Recharts, Framer Motion |
| Backend | Express 5, WebSocket (`ws`), `systeminformation` |
| Database | PostgreSQL 16 via Drizzle ORM (`@neondatabase/serverless` or `pg`) |
| Validation | Zod + `drizzle-zod` |
| AI | LM Studio (local LLM) with Server-Sent Events streaming |
| Routing | Wouter (frontend), Express (backend) |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                     Browser                         │
│  React + Vite  ←──  TanStack Query (polling 3-5s)  │
└────────────────────────┬────────────────────────────┘
                         │ HTTP / SSE
┌────────────────────────▼────────────────────────────┐
│                  Express Server                     │
│  REST API  │  Metrics Collector  │  Alert Engine    │
│  Webhook Dispatcher  │  XRPL WebSocket Proxy       │
└──────┬─────────────────────────────────┬────────────┘
       │ SQL (Drizzle ORM)               │ WebSocket
┌──────▼──────┐                  ┌───────▼────────┐
│ PostgreSQL  │                  │  XRPL Node(s)  │
└─────────────┘                  └────────────────┘
```

The backend acts as a thin proxy: it connects to your XRPL node over WebSocket, collects metrics on a 30-second interval, evaluates alert thresholds, dispatches webhooks, and persists snapshots to PostgreSQL. The frontend polls the REST API every 3-5 seconds for live updates and uses SSE for AI streaming responses.

## Project Structure

```
├── client/
│   ├── public/               Static assets (favicon)
│   └── src/
│       ├── components/       Reusable UI components
│       │   ├── ui/           Shadcn/ui primitives
│       │   ├── app-sidebar.tsx
│       │   ├── animated-bg.tsx
│       │   ├── circular-gauge.tsx
│       │   ├── metric-card.tsx
│       │   ├── resource-bar.tsx
│       │   ├── sparkline-chart.tsx
│       │   ├── status-indicator.tsx
│       │   ├── theme-provider.tsx
│       │   └── theme-toggle.tsx
│       ├── pages/            Route-level page components
│       │   ├── dashboard.tsx
│       │   ├── history.tsx
│       │   ├── alerts.tsx
│       │   ├── explorer.tsx
│       │   ├── ledger.tsx
│       │   ├── peers.tsx
│       │   ├── transactions.tsx
│       │   ├── validators.tsx
│       │   ├── ai-analysis.tsx
│       │   ├── system-health.tsx
│       │   ├── settings.tsx
│       │   ├── comparison.tsx
│       │   └── not-found.tsx
│       ├── hooks/            Custom React hooks
│       ├── lib/              Utilities (queryClient, sounds)
│       ├── App.tsx           Root component, routing, shortcuts
│       ├── index.css         Theme variables and custom utilities
│       └── main.tsx          Entry point
├── server/
│   ├── index.ts              Express setup, middleware, startup
│   ├── routes.ts             All API route handlers
│   ├── storage.ts            IStorage interface + DatabaseStorage
│   ├── db.ts                 Drizzle ORM connection (Neon / pg)
│   ├── vite.ts               Vite dev-server integration
│   └── static.ts             Static file serving (production)
├── shared/
│   └── schema.ts             Drizzle tables, Zod schemas, TS types
├── scripts/                  Install & start scripts (bash + PowerShell)
├── docker-compose.yml        One-command Docker deployment
├── Dockerfile                Multi-stage Node.js build
├── INSTALL.md                Detailed installation guide
└── package.json
```

## Getting Started

### Docker (Recommended)

```bash
git clone <your-repo-url> xrpl-monitor
cd xrpl-monitor
cp .env.example .env          # edit credentials before first run
docker compose up -d
```

> **Security note:** The default `docker-compose.yml` uses placeholder credentials (`changeme`). Always edit your `.env` file and set strong values for `POSTGRES_PASSWORD` and `SESSION_SECRET` before running in any environment.

Open **http://localhost:5000** in your browser. See [INSTALL.md](INSTALL.md) for Docker networking details (connecting to your XRPL node, LM Studio, etc.).

### Manual Setup

```bash
git clone <your-repo-url> xrpl-monitor
cd xrpl-monitor
npm install
cp .env.example .env        # edit with your DATABASE_URL
npm run db:push              # initialize database schema
npm run dev                  # start dev server
```

Open **http://localhost:5000**. See [INSTALL.md](INSTALL.md) for platform-specific instructions, script-based install, and production builds.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | — | Random string for Express session encryption |
| `PORT` | No | `5000` | Server port |
| `XRPL_HOST` | No | `host.docker.internal` | XRPL node hostname (Docker only) |
| `XRPL_WS_PORT` | No | `6006` | XRPL WebSocket port (Docker only) |
| `XRPL_HTTP_PORT` | No | `5005` | XRPL JSON-RPC port (Docker only) |
| `XRPL_ADMIN_PORT` | No | `8080` | XRPL admin port (Docker only) |
| `LM_STUDIO_URL` | No | — | LM Studio server URL for AI analysis |

## Configuration

### XRPL Node

Connect to your XRPL node in the **Settings** page or via environment variables. Default ports:

| Port | Purpose |
|------|---------|
| `6006` | WebSocket (peer protocol) |
| `5005` | JSON-RPC / HTTP |
| `8080` | Admin WebSocket |
| `51235` | Peer protocol |

Public nodes like `s2.ripple.com:51233` can be used if you don't run your own node.

### LM Studio (AI Analysis)

1. Install [LM Studio](https://lmstudio.ai/) and start its local server
2. Configure the connection in the **Settings** page (default: `localhost:1234`)
3. The AI analysis page provides context-aware prompts based on your node's current state

### Webhooks

Configure webhook notifications in **Settings** to receive alerts via:
- **Discord** — paste a Discord webhook URL
- **Telegram** — use the Telegram Bot API URL
- **Generic HTTP** — any endpoint that accepts POST requests

## API Reference

### Connection

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/connection` | Get current connection config |
| `POST` | `/api/connection` | Update connection config |

### Node Data

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/node/info` | Server info (version, state, ledger, uptime) |
| `GET` | `/api/node/ledger` | Current validated ledger details |
| `GET` | `/api/node/peers` | Connected peer list |
| `GET` | `/api/node/transactions` | Recent transactions |
| `GET` | `/api/node/tx/:hash` | Lookup transaction by hash |
| `GET` | `/api/node/account/:address` | Account info and balance |
| `GET` | `/api/node/account/:address/transactions` | Account transaction history |
| `GET` | `/api/node/fee` | Current fee levels |
| `GET` | `/api/node/validators` | Validator list |
| `GET` | `/api/node/amendments` | Amendment status and voting progress |
| `GET` | `/api/node/validator-info` | Extended validator info |
| `GET` | `/api/node/health-score` | Composite health score (0-100) with breakdown |
| `GET` | `/api/node/ledger-lag` | Ledger lag vs `s2.ripple.com` |
| `GET` | `/api/node/tps` | Current, average, and peak TPS |
| `GET` | `/api/node/unl-comparison` | UNL overlap comparison with `vl.ripple.com` |
| `GET` | `/api/node/peer-locations` | Peer IP geolocation data |

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/system/metrics` | Host CPU, memory, disk, network stats |

### Metrics & History

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/metrics/history?hours=N` | Historical metric snapshots |
| `GET` | `/api/export/report?hours=N&format=csv\|json` | Export metrics report |

### Alerts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/alerts` | Recent alerts |
| `GET` | `/api/alerts/unacknowledged` | Unacknowledged alert count |
| `GET` | `/api/alerts/thresholds` | Alert threshold configuration |
| `PUT` | `/api/alerts/thresholds/:id` | Update a threshold |
| `POST` | `/api/alerts/:id/acknowledge` | Acknowledge an alert |

### Multi-Node Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/nodes` | List saved nodes |
| `POST` | `/api/nodes` | Add a new node |
| `PUT` | `/api/nodes/:id` | Update a node |
| `DELETE` | `/api/nodes/:id` | Delete a node |
| `POST` | `/api/nodes/:id/activate` | Switch active node |
| `GET` | `/api/nodes/:id/status` | Check node connectivity |
| `GET` | `/api/nodes/compare` | Side-by-side comparison of all nodes |

### Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/webhooks` | List webhook configs |
| `POST` | `/api/webhooks` | Create a webhook |
| `PUT` | `/api/webhooks/:id` | Update a webhook |
| `DELETE` | `/api/webhooks/:id` | Delete a webhook |
| `POST` | `/api/webhooks/:id/test` | Send a test webhook |

### AI Analysis

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/ai/config` | Get LM Studio config |
| `POST` | `/api/ai/config` | Update LM Studio config |
| `POST` | `/api/ai/health-check` | Test LM Studio connectivity |
| `GET` | `/api/ai/sessions` | List chat sessions |
| `GET` | `/api/ai/history/:sessionId` | Get conversation history |
| `DELETE` | `/api/ai/session/:sessionId` | Delete a session |
| `POST` | `/api/ai/analyze` | Stream AI analysis (SSE) |

## Keyboard Shortcuts

| Keys | Action |
|------|--------|
| `g d` | Go to Dashboard |
| `g h` | Go to Metrics History |
| `g a` | Go to Alert Center |
| `g e` | Go to Network Explorer |
| `g p` | Go to Peers |
| `g v` | Go to Validators |
| `g i` | Go to AI Analysis |
| `g s` | Go to Settings |
| `g c` | Go to Comparison |
| `f` | Toggle Fullscreen |
| `?` | Show / Hide Shortcuts |

## Theming

The app ships with a cyberpunk/futuristic dark theme and a light mode alternative.

- **Fonts**: Oxanium (headings), JetBrains Mono (technical data)
- **Color palette**: Near-black backgrounds with electric cyan primary; neon accents in purple, pink, lime, and amber
- **Custom effects**: `cyber-glow`, `cyber-border`, `scanline`, `grid-bg`, `text-glow`, `neon-line`
- **Animated background**: Canvas-based particle field

Theme variables are defined in `client/src/index.css` using CSS custom properties consumed by the Tailwind config. Toggle between dark and light mode using the theme switch in the header.

## Database Schema

| Table | Purpose |
|-------|---------|
| `metrics_snapshots` | Time-series node metrics (30s intervals, 7-day retention) |
| `alerts` | Triggered alert records with severity and acknowledgement |
| `alert_thresholds` | Configurable warning/critical thresholds per metric |
| `saved_nodes` | Multi-node configurations with active flag |
| `ai_conversations` | Persisted AI chat history |
| `ai_config` | LM Studio connection settings |
| `webhook_configs` | Webhook endpoints with event filters |

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes and ensure they compile: `npm run check`
4. Commit with a descriptive message: `git commit -m "Add my feature"`
5. Push to your fork: `git push origin feature/my-feature`
6. Open a Pull Request

Please follow the existing code style and patterns. The project uses TypeScript throughout — run `npm run check` to verify type correctness before submitting.

## License

This project is licensed under the [MIT License](LICENSE).
