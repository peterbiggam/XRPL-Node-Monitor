import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, boolean, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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

export const metricsSnapshots = pgTable("metrics_snapshots", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  nodeHost: text("node_host"),
  cpuLoad: real("cpu_load"),
  memoryPercent: real("memory_percent"),
  peerCount: integer("peer_count"),
  ledgerIndex: integer("ledger_index"),
  closeTimeMs: real("close_time_ms"),
  loadFactor: real("load_factor"),
  serverState: text("server_state"),
  nodeLatencyMs: real("node_latency_ms"),
  reserveBase: real("reserve_base"),
  reserveInc: real("reserve_inc"),
  baseFee: real("base_fee"),
  tps: real("tps"),
});

export const webhookConfigs = pgTable("webhook_configs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("discord"),
  url: text("url").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  events: text("events").array().notNull().default(sql`ARRAY['alert_critical','alert_warning','connection_lost']`),
});

export const insertWebhookConfigSchema = createInsertSchema(webhookConfigs).omit({ id: true });
export type InsertWebhookConfig = z.infer<typeof insertWebhookConfigSchema>;
export type WebhookConfig = typeof webhookConfigs.$inferSelect;

export const insertMetricsSnapshotSchema = createInsertSchema(metricsSnapshots).omit({ id: true });
export type InsertMetricsSnapshot = z.infer<typeof insertMetricsSnapshotSchema>;
export type MetricsSnapshot = typeof metricsSnapshots.$inferSelect;

export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  type: text("type").notNull(),
  severity: text("severity").notNull(),
  message: text("message").notNull(),
  value: real("value"),
  threshold: real("threshold"),
  acknowledged: boolean("acknowledged").notNull().default(false),
});

export const insertAlertSchema = createInsertSchema(alerts).omit({ id: true });
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alerts.$inferSelect;

export const alertThresholds = pgTable("alert_thresholds", {
  id: serial("id").primaryKey(),
  metric: text("metric").notNull().unique(),
  warningValue: real("warning_value").notNull(),
  criticalValue: real("critical_value").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  direction: text("direction").notNull().default("above"),
});

export const insertAlertThresholdSchema = createInsertSchema(alertThresholds).omit({ id: true });
export type InsertAlertThreshold = z.infer<typeof insertAlertThresholdSchema>;
export type AlertThreshold = typeof alertThresholds.$inferSelect;

export const savedNodes = pgTable("saved_nodes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  host: text("host").notNull(),
  wsPort: integer("ws_port").notNull().default(6006),
  httpPort: integer("http_port").notNull().default(5005),
  adminPort: integer("admin_port").notNull().default(8080),
  isActive: boolean("is_active").notNull().default(false),
});

export const insertSavedNodeSchema = createInsertSchema(savedNodes).omit({ id: true });
export type InsertSavedNode = z.infer<typeof insertSavedNodeSchema>;
export type SavedNode = typeof savedNodes.$inferSelect;

export const aiConversations = pgTable("ai_conversations", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  sessionId: text("session_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  context: text("context"),
});

export const insertAiConversationSchema = createInsertSchema(aiConversations).omit({ id: true });
export type InsertAiConversation = z.infer<typeof insertAiConversationSchema>;
export type AiConversation = typeof aiConversations.$inferSelect;

export const aiConfig = pgTable("ai_config", {
  id: serial("id").primaryKey(),
  host: text("host").notNull().default("localhost"),
  port: integer("port").notNull().default(1234),
  model: text("model").default(""),
});

export const insertAiConfigSchema = createInsertSchema(aiConfig).omit({ id: true });
export type InsertAiConfig = z.infer<typeof insertAiConfigSchema>;
export type AiConfig = typeof aiConfig.$inferSelect;

export interface ConnectionConfig {
  host: string;
  wsPort: number;
  httpPort: number;
  adminPort: number;
}

export const connectionConfigSchema = z.object({
  host: z.string().min(1),
  wsPort: z.number().int().min(1).max(65535),
  httpPort: z.number().int().min(1).max(65535),
  adminPort: z.number().int().min(1).max(65535),
});

export interface NodeInfo {
  buildVersion: string;
  completeLedgers: string;
  hostId: string;
  initialSyncDurationUs: string;
  ioLatencyMs: number;
  jqTransOverflow: string;
  lastClose: {
    convergeTimeS: number;
    proposers: number;
  };
  loadFactor: number;
  peerDisconnects: string;
  peerDisconnectsResources: string;
  peers: number;
  pubkeyNode: string;
  serverState: string;
  serverStateDurationUs: string;
  stateAccounting: Record<string, { durationUs: string; transitions: string }>;
  time: string;
  uptime: number;
  validatedLedger: {
    age: number;
    baseFee: number;
    hash: string;
    reserveBase: number;
    reserveInc: number;
    seq: number;
  };
  validationQuorum: number;
}

export interface LedgerInfo {
  ledgerIndex: number;
  ledgerHash: string;
  closeTime: number;
  closeTimeHuman: string;
  parentHash: string;
  totalCoins: string;
  transactionCount: number;
  accountHash: string;
  txHash: string;
}

export interface PeerInfo {
  address: string;
  completeLedgers: string;
  latency: number;
  ledgerHash: string;
  inbound: boolean;
  publicKey: string;
  uptime: number;
  version: string;
  sanity: string;
}

export interface TransactionInfo {
  hash: string;
  type: string;
  account: string;
  destination?: string;
  amount?: string;
  fee: string;
  result: string;
  ledgerIndex: number;
  date: number;
}

export interface AccountInfo {
  address: string;
  balance: string;
  sequence: number;
  ownerCount: number;
  previousTxnID: string;
  flags: number;
}

export interface FeeInfo {
  currentLedgerSize: number;
  expectedLedgerSize: number;
  maxQueueSize: number;
  medianFee: string;
  minimumFee: string;
  openLedgerFee: string;
}

export interface ValidatorInfo {
  publicKey: string;
  signingKey?: string;
  masterKey?: string;
  domain?: string;
  agreement?: string;
  partial?: boolean;
  unl?: boolean;
}

export interface AmendmentInfo {
  name: string;
  id: string;
  enabled: boolean;
  supported: boolean;
  vetoed: boolean;
  count?: number;
  threshold?: number;
}

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
