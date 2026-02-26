import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, boolean, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table — basic authentication for future multi-user support
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Metrics snapshots — periodic readings of system + XRPL node health,
// collected every 30s by the background metrics collector in routes.ts.
// Old entries are pruned after 7 days to prevent unbounded growth.
export const metricsSnapshots = pgTable("metrics_snapshots", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  nodeHost: text("node_host"),                // which node was being monitored
  cpuLoad: real("cpu_load"),                  // host machine CPU percentage
  memoryPercent: real("memory_percent"),       // host machine RAM percentage
  peerCount: integer("peer_count"),           // number of XRPL peers connected
  ledgerIndex: integer("ledger_index"),       // latest validated ledger sequence
  closeTimeMs: real("close_time_ms"),         // last ledger close convergence time in ms
  loadFactor: real("load_factor"),            // XRPL server load factor (1 = normal)
  serverState: text("server_state"),          // e.g. "full", "proposing", "syncing"
  nodeLatencyMs: real("node_latency_ms"),     // WebSocket round-trip latency to the node
  reserveBase: real("reserve_base"),          // XRP base reserve (in XRP)
  reserveInc: real("reserve_inc"),            // XRP owner reserve increment (in XRP)
  baseFee: real("base_fee"),                  // base transaction fee (in XRP)
  tps: real("tps"),                           // estimated transactions per second
});

// Webhook configurations — user-defined notification endpoints (Discord, Telegram, generic)
// that receive alerts when thresholds are breached or connections are lost.
export const webhookConfigs = pgTable("webhook_configs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),                // display name for the webhook
  type: text("type").notNull().default("discord"), // "discord" | "telegram" | "generic"
  url: text("url").notNull(),                  // webhook URL (or "botToken|chatId" for Telegram)
  enabled: boolean("enabled").notNull().default(true),
  events: text("events").array().notNull().default(sql`ARRAY['alert_critical','alert_warning','connection_lost']`),
});

export const insertWebhookConfigSchema = createInsertSchema(webhookConfigs).omit({ id: true });
export type InsertWebhookConfig = z.infer<typeof insertWebhookConfigSchema>;
export type WebhookConfig = typeof webhookConfigs.$inferSelect;

export const insertMetricsSnapshotSchema = createInsertSchema(metricsSnapshots).omit({ id: true });
export type InsertMetricsSnapshot = z.infer<typeof insertMetricsSnapshotSchema>;
export type MetricsSnapshot = typeof metricsSnapshots.$inferSelect;

// Alerts — generated when a monitored metric crosses a threshold.
// Duplicate alerts for the same metric are suppressed within a 5-minute window.
export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  type: text("type").notNull(),               // metric key, e.g. "cpu", "memory", "peers"
  severity: text("severity").notNull(),       // "warning" | "critical"
  message: text("message").notNull(),         // human-readable description
  value: real("value"),                       // the metric value that triggered the alert
  threshold: real("threshold"),               // the threshold that was breached
  acknowledged: boolean("acknowledged").notNull().default(false),
});

export const insertAlertSchema = createInsertSchema(alerts).omit({ id: true });
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alerts.$inferSelect;

// Alert thresholds — configurable warning/critical limits per metric.
// "direction" determines whether alerting triggers when value goes "above" or "below" the threshold
// (e.g. peers alert when count drops *below*, CPU alerts when load goes *above*).
export const alertThresholds = pgTable("alert_thresholds", {
  id: serial("id").primaryKey(),
  metric: text("metric").notNull().unique(),       // metric key matching alerts.type
  warningValue: real("warning_value").notNull(),
  criticalValue: real("critical_value").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  direction: text("direction").notNull().default("above"), // "above" or "below"
});

export const insertAlertThresholdSchema = createInsertSchema(alertThresholds).omit({ id: true });
export type InsertAlertThreshold = z.infer<typeof insertAlertThresholdSchema>;
export type AlertThreshold = typeof alertThresholds.$inferSelect;

// Saved nodes — user-managed list of XRPL nodes for multi-node monitoring.
// Only one node can be "active" at a time; it becomes the default target for all queries.
export const savedNodes = pgTable("saved_nodes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  host: text("host").notNull(),
  wsPort: integer("ws_port").notNull().default(6006),    // WebSocket port for public commands
  httpPort: integer("http_port").notNull().default(5005), // HTTP JSON-RPC port
  adminPort: integer("admin_port").notNull().default(8080), // Admin port for peers/validators
  isActive: boolean("is_active").notNull().default(false),
});

export const insertSavedNodeSchema = createInsertSchema(savedNodes).omit({ id: true });
export type InsertSavedNode = z.infer<typeof insertSavedNodeSchema>;
export type SavedNode = typeof savedNodes.$inferSelect;

// AI conversations — chat history for the LM Studio integration.
// Messages are grouped by sessionId so users can have multiple analysis threads.
export const aiConversations = pgTable("ai_conversations", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  sessionId: text("session_id").notNull(),    // groups messages into conversation threads
  role: text("role").notNull(),               // "user" | "assistant" | "system"
  content: text("content").notNull(),
  context: text("context"),                   // optional context hint: "node", "ledger", "peers", etc.
});

export const insertAiConversationSchema = createInsertSchema(aiConversations).omit({ id: true });
export type InsertAiConversation = z.infer<typeof insertAiConversationSchema>;
export type AiConversation = typeof aiConversations.$inferSelect;

// AI config — LM Studio connection settings (host, port, model).
// Only one row exists; upserted on save. Can be seeded from LM_STUDIO_URL env var.
export const aiConfig = pgTable("ai_config", {
  id: serial("id").primaryKey(),
  host: text("host").notNull().default("localhost"),
  port: integer("port").notNull().default(1234),
  model: text("model").default(""),
});

export const insertAiConfigSchema = createInsertSchema(aiConfig).omit({ id: true });
export type InsertAiConfig = z.infer<typeof insertAiConfigSchema>;
export type AiConfig = typeof aiConfig.$inferSelect;

// Runtime connection config — not persisted in DB, held in memory.
// Represents the currently-targeted XRPL node's endpoint details.
export interface ConnectionConfig {
  host: string;
  wsPort: number;
  httpPort: number;
  adminPort: number;
}

// Zod schema for validating incoming connection config from the API
export const connectionConfigSchema = z.object({
  host: z.string().min(1),
  wsPort: z.number().int().min(1).max(65535),
  httpPort: z.number().int().min(1).max(65535),
  adminPort: z.number().int().min(1).max(65535),
});

// --- XRPL domain types ---
// These interfaces mirror the shape of data returned by XRPL WebSocket commands,
// normalized into camelCase for frontend consumption.

// server_info response — core node operational data
export interface NodeInfo {
  buildVersion: string;
  completeLedgers: string;          // range of ledgers the node has, e.g. "32570-12345678"
  hostId: string;
  initialSyncDurationUs: string;
  ioLatencyMs: number;
  jqTransOverflow: string;
  lastClose: {
    convergeTimeS: number;          // seconds to reach consensus on last ledger
    proposers: number;              // number of validators that proposed
  };
  loadFactor: number;               // 1 = no load, higher = congested
  peerDisconnects: string;
  peerDisconnectsResources: string;
  peers: number;
  pubkeyNode: string;
  serverState: string;              // "full", "proposing", "validating", "syncing", etc.
  serverStateDurationUs: string;
  stateAccounting: Record<string, { durationUs: string; transitions: string }>;
  time: string;
  uptime: number;                   // seconds since node started
  validatedLedger: {
    age: number;                    // seconds since last validated ledger
    baseFee: number;
    hash: string;
    reserveBase: number;
    reserveInc: number;
    seq: number;                    // latest validated ledger sequence number
  };
  validationQuorum: number;
}

// Validated ledger summary
export interface LedgerInfo {
  ledgerIndex: number;
  ledgerHash: string;
  closeTime: number;
  closeTimeHuman: string;
  parentHash: string;
  totalCoins: string;               // total XRP in existence (drops)
  transactionCount: number;
  accountHash: string;
  txHash: string;
}

// Individual peer connection details from the admin "peers" command
export interface PeerInfo {
  address: string;
  completeLedgers: string;
  latency: number;
  ledgerHash: string;
  inbound: boolean;                 // true if peer initiated the connection to us
  publicKey: string;
  uptime: number;
  version: string;                  // rippled version the peer is running
  sanity: string;
}

// Normalized transaction data used in the live feed and explorer
export interface TransactionInfo {
  hash: string;
  type: string;                     // e.g. "Payment", "OfferCreate", "TrustSet"
  account: string;
  destination?: string;
  amount?: string;                  // in drops for native XRP, or token value
  fee: string;
  result: string;                   // e.g. "tesSUCCESS"
  ledgerIndex: number;
  date: number;                     // XRPL epoch timestamp (seconds since 2000-01-01)
}

// account_info response
export interface AccountInfo {
  address: string;
  balance: string;                  // balance in drops
  sequence: number;
  ownerCount: number;               // number of owned objects (trust lines, offers, etc.)
  previousTxnID: string;
  flags: number;
}

// fee command response — current transaction fee estimates
export interface FeeInfo {
  currentLedgerSize: number;
  expectedLedgerSize: number;
  maxQueueSize: number;
  medianFee: string;                // in drops
  minimumFee: string;
  openLedgerFee: string;
}

// Validator info from the "validators" admin command
export interface ValidatorInfo {
  publicKey: string;
  signingKey?: string;
  masterKey?: string;
  domain?: string;
  agreement?: string;               // consensus agreement percentage
  partial?: boolean;
  unl?: boolean;                    // whether the validator is on the trusted UNL
}

// Amendment (protocol feature) status from the "feature" admin command
export interface AmendmentInfo {
  name: string;
  id: string;                       // 64-char hex amendment ID
  enabled: boolean;                 // whether the amendment is active on the network
  supported: boolean;               // whether this node's software supports it
  vetoed: boolean;                  // whether the operator has vetoed this amendment
  count?: number;                   // number of validators voting for it
  threshold?: number;               // votes needed for activation
}

// Host system metrics gathered via the systeminformation library
export interface SystemMetrics {
  cpu: {
    currentLoad: number;
    avgLoad: number;
    cores: number;
    model: string;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usedPercent: number;
  };
  disk: {
    fs: string;
    size: number;
    used: number;
    available: number;
    usedPercent: number;
    mount: string;
  }[];
  network: {
    iface: string;
    rxBytes: number;
    txBytes: number;
    rxSec: number;
    txSec: number;
  }[];
  uptime: number;
  os: {
    platform: string;
    hostname: string;
    kernel: string;
    arch: string;
  };
}
