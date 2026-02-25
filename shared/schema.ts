import { sql } from "drizzle-orm";
import { pgTable, text, varchar } from "drizzle-orm/pg-core";
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
