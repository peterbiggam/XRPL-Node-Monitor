// Database connection module — uses SQLite via better-sqlite3.
// The database file path is configurable via DATABASE_PATH env var,
// defaulting to ./data/xrpl-monitor.db. The data directory is auto-created.
// Tables are auto-created on startup if they don't exist.

import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "@shared/schema";
import { mkdirSync } from "fs";
import { dirname } from "path";

const dbPath = process.env.DATABASE_PATH || "./data/xrpl-monitor.db";

mkdirSync(dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);

sqlite.pragma("journal_mode = WAL");
sqlite.pragma("busy_timeout = 5000");
sqlite.pragma("foreign_keys = ON");

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS metrics_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
    node_host TEXT,
    cpu_load REAL,
    memory_percent REAL,
    peer_count INTEGER,
    ledger_index INTEGER,
    close_time_ms REAL,
    load_factor REAL,
    server_state TEXT,
    node_latency_ms REAL,
    reserve_base REAL,
    reserve_inc REAL,
    base_fee REAL,
    tps REAL
  );

  CREATE TABLE IF NOT EXISTS webhook_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'discord',
    url TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    events TEXT NOT NULL DEFAULT '["alert_critical","alert_warning","connection_lost"]'
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
    type TEXT NOT NULL,
    severity TEXT NOT NULL,
    message TEXT NOT NULL,
    value REAL,
    threshold REAL,
    acknowledged INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS alert_thresholds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric TEXT NOT NULL UNIQUE,
    warning_value REAL NOT NULL,
    critical_value REAL NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    direction TEXT NOT NULL DEFAULT 'above'
  );

  CREATE TABLE IF NOT EXISTS saved_nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    host TEXT NOT NULL DEFAULT 'localhost',
    ws_port INTEGER NOT NULL DEFAULT 6006,
    http_port INTEGER NOT NULL DEFAULT 5005,
    admin_port INTEGER NOT NULL DEFAULT 8080,
    is_active INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS ai_conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    context TEXT
  );

  CREATE TABLE IF NOT EXISTS ai_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    host TEXT NOT NULL DEFAULT 'localhost',
    port INTEGER NOT NULL DEFAULT 1234,
    model TEXT DEFAULT ''
  );
`);

export const db = drizzle(sqlite, { schema });
