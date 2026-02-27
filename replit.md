# XRPL Node Monitor Dashboard

## Overview
A cross-platform XRPL (XRP Ledger) node monitoring dashboard with a cyberpunk/sci-fi command center aesthetic. Provides real-time insights into node operations, network health, system performance, with persistent metrics history, alerting, AI analysis, multi-node support, webhook notifications, and composite health scoring.

## Architecture
- **Frontend**: React + Vite with Tailwind CSS, Shadcn UI components, Recharts for data visualization
- **Backend**: Express.js server with WebSocket proxy to XRPL node, systeminformation for system metrics
- **Database**: SQLite via better-sqlite3 + drizzle-orm for persistent storage (zero-config, file-based)
- **Real-time**: Polling-based updates (3-5 second intervals) for live data, SSE for AI streaming

## Key Features
- **Dashboard**: Overview of node status, latest ledger, network peers, performance metrics, **health score gauge (0-100)**, **TPS metric**, **ledger lag indicator**
- **Metrics History**: Time-series charts (1h/6h/24h/7d) for CPU, memory, peers, ledger close times, load factor, **node latency**, **TPS over time**, **base fee trend**, **latency heatmap** with CSV/JSON export
- **Alert Center**: Threshold-based alerting with configurable warning/critical levels, cooldown logic, acknowledge functionality, pulsing sidebar badge, **webhook dispatch on alerts**
- **Network Explorer**: Transaction hash lookup, account info/balance, fee estimator
- **Ledger Explorer**: Detailed ledger information, recent ledger list, close time chart
- **Peers**: Connected peer table + force-directed network graph visualization with latency-based coloring, **geolocation world map** with peer dots
- **Transactions**: Live transaction feed with type distribution pie chart
- **Validators & Amendments**: Validator list, amendment status with progress tracking, **UNL comparison** (overlap with vl.ripple.com)
- **AI Analysis**: LM Studio integration with SSE streaming chat, context-aware prompts, conversation history
- **System Health**: CPU/memory gauges, disk usage bars, network I/O chart, OS info
- **Settings**: Node connection config, multi-node management (add/edit/delete/activate), LM Studio config, **webhook notification config** (Discord/Telegram/generic HTTP)
- **Comparison**: **Multi-node side-by-side comparison** table with live status
- **Keyboard Shortcuts**: Global `g+key` navigation, `f` fullscreen, `?` help modal
- **Fullscreen Mode**: Browser Fullscreen API toggle for ops/wall-mounted displays
- **Sound Effects**: Web Audio API synthesized sounds for alerts, connections, with toggle control

## Database Tables
- `metricsSnapshots` — time-series node metrics (30s intervals, 7-day retention) with nodeLatencyMs, reserveBase, reserveInc, baseFee, tps
- `alerts` — triggered alert records with severity/acknowledgement
- `alertThresholds` — configurable warning/critical thresholds per metric
- `savedNodes` — multi-node configurations with active flag
- `aiConversations` — persisted AI chat history
- `aiConfig` — LM Studio connection settings
- `webhookConfigs` — webhook notification endpoints (Discord/Telegram/generic) with event filters

## Port Configuration
Default XRPL node ports: WebSocket 6006, HTTP/JSON-RPC 5005, Admin 8080.
Backend tries configured port first, then falls back to 6006 → 5005 → 8080.
App runs on port 5000 (other ports firewalled).

## Project Structure
```
client/src/
  pages/          - Dashboard, History, Alerts, Explorer, Ledger, Peers, Transactions, Validators, AIAnalysis, SystemHealth, Settings, Comparison
  components/     - AppSidebar, MetricCard, CircularGauge, ResourceBar, SparklineChart, StatusIndicator, ThemeProvider, ThemeToggle, AnimatedBackground
  components/ui/  - Shadcn UI components
  lib/            - queryClient, sounds
server/
  routes.ts       - API routes for XRPL proxy, metrics, alerts, nodes, AI, export, webhooks, health score, ledger lag, TPS, UNL, peer geolocation, node comparison
  storage.ts      - DatabaseStorage class implementing IStorage interface
  db.ts           - Drizzle ORM database connection (SQLite via better-sqlite3, auto-creates tables)
shared/
  schema.ts       - Drizzle tables, insert schemas (drizzle-zod), TypeScript types
```

## API Endpoints
- `GET/POST /api/connection` — Connection config
- `GET /api/node/info|ledger|peers|transactions` — XRPL node data
- `GET /api/node/tx/:hash` — Transaction lookup
- `GET /api/node/account/:address` — Account info
- `GET /api/node/fee` — Current fee levels
- `GET /api/node/validators|amendments` — Validator/amendment data
- `GET /api/node/health-score` — Composite health score (0-100) with component breakdown
- `GET /api/node/ledger-lag` — Ledger lag vs s2.ripple.com public node
- `GET /api/node/tps` — Current/avg/peak transactions per second
- `GET /api/node/unl-comparison` — UNL overlap comparison with vl.ripple.com
- `GET /api/node/peer-locations` — Peer IP geolocation via ip-api.com
- `GET /api/nodes/compare` — Multi-node side-by-side comparison
- `GET /api/system/metrics` — System CPU, memory, disk, network
- `GET /api/metrics/history?hours=N` — Historical metrics snapshots
- `GET /api/alerts` — Recent alerts
- `GET/PUT /api/alerts/thresholds` — Alert threshold config
- `POST /api/alerts/:id/acknowledge` — Acknowledge alert
- `GET/POST/PUT/DELETE /api/nodes` — Multi-node CRUD
- `POST /api/nodes/:id/activate` — Switch active node
- `GET/POST/PUT/DELETE /api/webhooks` — Webhook notification config
- `POST /api/webhooks/:id/test` — Test webhook delivery
- `GET/POST /api/ai/config` — LM Studio settings
- `POST /api/ai/analyze` — AI analysis with SSE streaming
- `GET /api/ai/history` — Chat history
- `GET /api/export/report?hours=N&format=csv|json` — Export reports

## Theme - Cyberpunk/Futuristic Command Center
- Dark mode by default with light mode toggle
- Near-black backgrounds (225 30% 3%) with electric cyan primary (185 100% 50%)
- Neon chart colors: cyan, electric purple, hot pink, lime green, amber
- Oxanium font (headings/sans), JetBrains Mono (technical data/mono)
- Custom CSS effects: cyber-glow, cyber-border, scanline, grid-bg, text-glow, neon-line
- Canvas particle field animated background (animated-bg.tsx)
- Framer-motion staggered entrance animations on all pages
- HUD-style panels, hexagonal badge icons, glowing gauge components

## Dependencies
- systeminformation — System hardware/OS metrics
- ws — WebSocket client for XRPL node communication
- recharts — Charts and data visualization
- framer-motion — Page entrance animations and motion effects
- better-sqlite3 + drizzle-orm — SQLite database (zero external deps)
- drizzle-zod — Schema validation
