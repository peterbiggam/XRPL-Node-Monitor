# XRPL Node Monitor Dashboard

## Overview
A cross-platform XRPL (XRP Ledger) node monitoring dashboard that provides real-time insights into node operations, network health, and system performance. Designed for node operators running on Docker (Windows) or native Linux installations.

## Architecture
- **Frontend**: React + Vite with Tailwind CSS, Shadcn UI components, Recharts for data visualization
- **Backend**: Express.js server with WebSocket proxy to XRPL node, systeminformation for system metrics
- **Real-time**: Polling-based updates (3-5 second intervals) for live data

## Key Features
- **Dashboard**: Overview of node status, latest ledger, network peers, and performance metrics
- **Ledger Explorer**: Detailed ledger information, recent ledger list, close time chart
- **Peers**: Connected peer table with masked IPs, direction badges, latency, and uptime
- **Transactions**: Live transaction feed with type distribution pie chart
- **System Health**: CPU/memory gauges, disk usage bars, network I/O chart, OS info
- **Settings**: Configure node connection (host, WebSocket/HTTP/admin ports)

## Port Configuration
Default XRPL node ports:
- WebSocket: 6006
- HTTP/JSON-RPC: 5005
- Admin: 8080

The backend tries configured port first, then falls back to 6006 → 5005 → 8080.

## Project Structure
```
client/src/
  pages/          - Dashboard, Ledger, Peers, Transactions, SystemHealth, Settings
  components/     - AppSidebar, MetricCard, CircularGauge, ResourceBar, SparklineChart, StatusIndicator, ThemeProvider, ThemeToggle
  components/ui/  - Shadcn UI components
server/
  routes.ts       - API routes for XRPL proxy and system metrics
  storage.ts      - In-memory storage for connection config
shared/
  schema.ts       - TypeScript interfaces and Zod schemas
```

## API Endpoints
- `GET /api/connection` - Current connection config
- `POST /api/connection` - Update connection config
- `GET /api/node/info` - XRPL server_info
- `GET /api/node/ledger` - Latest validated ledger
- `GET /api/node/peers` - Connected peers list
- `GET /api/node/transactions` - Recent transactions
- `GET /api/system/metrics` - System CPU, memory, disk, network stats

## Theme
- Dark mode by default with light mode toggle
- Cyan/blue accent colors (XRPL-branded)
- Space Grotesk font (sans), JetBrains Mono (mono)

## Dependencies
- systeminformation - System hardware/OS metrics
- ws - WebSocket client for XRPL node communication
- recharts - Charts and data visualization
- framer-motion - Animations
