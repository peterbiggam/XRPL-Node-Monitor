// Storage layer — abstracts all database CRUD behind the IStorage interface.
// DatabaseStorage is the concrete implementation backed by SQLite via Drizzle ORM.

import { eq, desc, gte, and, sql } from "drizzle-orm";
import { db } from "./db";
import {
  type ConnectionConfig,
  type InsertMetricsSnapshot,
  type MetricsSnapshot,
  type InsertAlert,
  type Alert,
  type InsertAlertThreshold,
  type AlertThreshold,
  type InsertSavedNode,
  type SavedNode,
  type InsertAiConversation,
  type AiConversation,
  type AiConfig,
  type InsertAiConfig,
  type InsertWebhookConfig,
  type WebhookConfig,
  metricsSnapshots,
  alerts,
  alertThresholds,
  savedNodes,
  aiConversations,
  aiConfig,
  webhookConfigs,
} from "@shared/schema";

// IStorage defines every data operation the application needs.
// This allows swapping implementations (e.g. in-memory for testing) without changing routes.
export interface IStorage {
  // Connection config — in-memory XRPL node target (overridden by active saved node)
  getConnectionConfig(): Promise<ConnectionConfig>;
  setConnectionConfig(config: ConnectionConfig): Promise<ConnectionConfig>;

  // Metrics snapshots — time-series system + node health readings
  addMetricsSnapshot(snapshot: InsertMetricsSnapshot): Promise<MetricsSnapshot>;
  getMetricsHistory(hours: number): Promise<MetricsSnapshot[]>;
  cleanOldMetrics(days: number): Promise<void>;

  // Alerts — threshold-breach notifications
  getAlerts(limit?: number): Promise<Alert[]>;
  getUnacknowledgedAlerts(): Promise<Alert[]>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  acknowledgeAlert(id: number): Promise<Alert | null>;
  getRecentAlertByType(type: string, minutes: number): Promise<Alert | null>;

  // Alert thresholds — per-metric warning/critical limits
  getAlertThresholds(): Promise<AlertThreshold[]>;
  getAlertThreshold(id: number): Promise<AlertThreshold | null>;
  updateAlertThreshold(id: number, data: Partial<InsertAlertThreshold>): Promise<AlertThreshold | null>;
  seedDefaultThresholds(): Promise<void>;

  // Saved nodes — multi-node management with one active node at a time
  getSavedNodes(): Promise<SavedNode[]>;
  getSavedNode(id: number): Promise<SavedNode | null>;
  createSavedNode(node: InsertSavedNode): Promise<SavedNode>;
  updateSavedNode(id: number, data: Partial<InsertSavedNode>): Promise<SavedNode | null>;
  deleteSavedNode(id: number): Promise<boolean>;
  setActiveNode(id: number): Promise<SavedNode | null>;
  getActiveNode(): Promise<SavedNode | null>;

  // AI conversations — LM Studio chat history grouped by session
  getAiConversations(sessionId: string): Promise<AiConversation[]>;
  getAiSessions(): Promise<{ sessionId: string; lastMessage: string; timestamp: Date }[]>;
  addAiMessage(message: InsertAiConversation): Promise<AiConversation>;
  clearAiSession(sessionId: string): Promise<void>;

  // AI config — LM Studio connection settings (singleton row)
  getAiConfig(): Promise<AiConfig | null>;
  setAiConfig(config: InsertAiConfig): Promise<AiConfig>;

  // Webhook configs — notification endpoint CRUD
  getWebhookConfigs(): Promise<WebhookConfig[]>;
  getWebhookConfig(id: number): Promise<WebhookConfig | null>;
  createWebhookConfig(config: InsertWebhookConfig): Promise<WebhookConfig>;
  updateWebhookConfig(id: number, data: Partial<InsertWebhookConfig>): Promise<WebhookConfig | null>;
  deleteWebhookConfig(id: number): Promise<boolean>;
  getEnabledWebhooksForEvent(event: string): Promise<WebhookConfig[]>;
}

// Helper: parse the events JSON text column into a string array
function parseEvents(events: string | null): string[] {
  if (!events) return [];
  try {
    return JSON.parse(events);
  } catch {
    return [];
  }
}

// Helper: ensure events is a JSON string for storage
function serializeEvents(events: string | string[] | null | undefined): string {
  if (!events) return '["alert_critical","alert_warning","connection_lost"]';
  if (typeof events === "string") return events;
  return JSON.stringify(events);
}

export class DatabaseStorage implements IStorage {
  // In-memory fallback connection config, used when no saved node is active.
  // Initialized from XRPL_* env vars (defaults to localhost with standard rippled ports).
  private connectionConfig: ConnectionConfig;

  constructor() {
    this.connectionConfig = {
      host: process.env.XRPL_HOST || "localhost",
      wsPort: parseInt(process.env.XRPL_WS_PORT || "6006", 10),
      httpPort: parseInt(process.env.XRPL_HTTP_PORT || "5005", 10),
      adminPort: parseInt(process.env.XRPL_ADMIN_PORT || "8080", 10),
    };
    this.seedAiConfigFromEnv();
  }

  // Auto-creates an AI config row from the LM_STUDIO_URL environment variable
  // on first startup, so users don't have to configure it manually in the UI.
  private async seedAiConfigFromEnv() {
    if (process.env.LM_STUDIO_URL) {
      try {
        const url = new URL(process.env.LM_STUDIO_URL);
        const existing = await this.getAiConfig();
        if (!existing) {
          await this.setAiConfig({
            host: url.hostname,
            port: parseInt(url.port || "1234", 10),
            model: "",
          });
        }
      } catch {}
    }
  }

  // Returns connection config for the currently active node.
  // If a saved node is marked active, its settings override the in-memory defaults.
  async getConnectionConfig(): Promise<ConnectionConfig> {
    const activeNode = await this.getActiveNode();
    if (activeNode) {
      return {
        host: activeNode.host,
        wsPort: activeNode.wsPort,
        httpPort: activeNode.httpPort,
        adminPort: activeNode.adminPort,
      };
    }
    return { ...this.connectionConfig };
  }

  async setConnectionConfig(config: ConnectionConfig): Promise<ConnectionConfig> {
    this.connectionConfig = { ...config };
    return this.connectionConfig;
  }

  async addMetricsSnapshot(snapshot: InsertMetricsSnapshot): Promise<MetricsSnapshot> {
    const [result] = await db.insert(metricsSnapshots).values(snapshot).returning();
    return result;
  }

  // Returns snapshots from the last N hours, ordered chronologically for charting
  async getMetricsHistory(hours: number): Promise<MetricsSnapshot[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    return db.select().from(metricsSnapshots).where(gte(metricsSnapshots.timestamp, since)).orderBy(metricsSnapshots.timestamp);
  }

  // Deletes snapshots older than N days to prevent unbounded table growth
  async cleanOldMetrics(days: number): Promise<void> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    await db.delete(metricsSnapshots).where(sql`${metricsSnapshots.timestamp} < ${cutoff.getTime() / 1000}`);
  }

  async getAlerts(limit = 100): Promise<Alert[]> {
    return db.select().from(alerts).orderBy(desc(alerts.timestamp)).limit(limit);
  }

  async getUnacknowledgedAlerts(): Promise<Alert[]> {
    return db.select().from(alerts).where(eq(alerts.acknowledged, false)).orderBy(desc(alerts.timestamp));
  }

  async createAlert(alert: InsertAlert): Promise<Alert> {
    const [result] = await db.insert(alerts).values(alert).returning();
    return result;
  }

  async acknowledgeAlert(id: number): Promise<Alert | null> {
    const [result] = await db.update(alerts).set({ acknowledged: true }).where(eq(alerts.id, id)).returning();
    return result || null;
  }

  // Checks if an alert of the same type was already fired within the last N minutes.
  // Used to suppress duplicate alerts and avoid notification spam.
  async getRecentAlertByType(type: string, minutes: number): Promise<Alert | null> {
    const since = new Date(Date.now() - minutes * 60 * 1000);
    const results = await db.select().from(alerts)
      .where(and(eq(alerts.type, type), gte(alerts.timestamp, since)))
      .orderBy(desc(alerts.timestamp))
      .limit(1);
    return results[0] || null;
  }

  async getAlertThresholds(): Promise<AlertThreshold[]> {
    return db.select().from(alertThresholds);
  }

  async getAlertThreshold(id: number): Promise<AlertThreshold | null> {
    const [result] = await db.select().from(alertThresholds).where(eq(alertThresholds.id, id));
    return result || null;
  }

  async updateAlertThreshold(id: number, data: Partial<InsertAlertThreshold>): Promise<AlertThreshold | null> {
    const [result] = await db.update(alertThresholds).set(data).where(eq(alertThresholds.id, id)).returning();
    return result || null;
  }

  // Inserts default alert thresholds on first run (CPU, memory, peers, ledger age).
  // Skipped if any thresholds already exist, so user customizations are preserved.
  async seedDefaultThresholds(): Promise<void> {
    const existing = await this.getAlertThresholds();
    if (existing.length > 0) return;

    const defaults: InsertAlertThreshold[] = [
      { metric: "cpu", warningValue: 80, criticalValue: 95, enabled: true, direction: "above" },
      { metric: "memory", warningValue: 85, criticalValue: 95, enabled: true, direction: "above" },
      { metric: "peers", warningValue: 10, criticalValue: 3, enabled: true, direction: "below" },
      { metric: "ledger_age", warningValue: 30, criticalValue: 60, enabled: true, direction: "above" },
    ];

    await db.insert(alertThresholds).values(defaults);
  }

  // --- Saved Node CRUD ---

  async getSavedNodes(): Promise<SavedNode[]> {
    return db.select().from(savedNodes);
  }

  async getSavedNode(id: number): Promise<SavedNode | null> {
    const [result] = await db.select().from(savedNodes).where(eq(savedNodes.id, id));
    return result || null;
  }

  async createSavedNode(node: InsertSavedNode): Promise<SavedNode> {
    const [result] = await db.insert(savedNodes).values(node).returning();
    return result;
  }

  async updateSavedNode(id: number, data: Partial<InsertSavedNode>): Promise<SavedNode | null> {
    const [result] = await db.update(savedNodes).set(data).where(eq(savedNodes.id, id)).returning();
    return result || null;
  }

  async deleteSavedNode(id: number): Promise<boolean> {
    const result = await db.delete(savedNodes).where(eq(savedNodes.id, id)).returning();
    return result.length > 0;
  }

  // Activates a node by deactivating all others first (only one active at a time).
  // Also updates the in-memory connectionConfig so subsequent requests target the new node.
  async setActiveNode(id: number): Promise<SavedNode | null> {
    await db.update(savedNodes).set({ isActive: false }).where(eq(savedNodes.isActive, true));
    const [result] = await db.update(savedNodes).set({ isActive: true }).where(eq(savedNodes.id, id)).returning();
    if (result) {
      this.connectionConfig = {
        host: result.host,
        wsPort: result.wsPort,
        httpPort: result.httpPort,
        adminPort: result.adminPort,
      };
    }
    return result || null;
  }

  async getActiveNode(): Promise<SavedNode | null> {
    const results = await db.select().from(savedNodes).where(eq(savedNodes.isActive, true)).limit(1);
    return results[0] || null;
  }

  // --- AI Conversation methods ---

  async getAiConversations(sessionId: string): Promise<AiConversation[]> {
    return db.select().from(aiConversations)
      .where(eq(aiConversations.sessionId, sessionId))
      .orderBy(aiConversations.timestamp);
  }

  // Returns a summary of each unique session (last user message + timestamp).
  // Uses GROUP BY + MAX since SQLite doesn't support DISTINCT ON.
  async getAiSessions(): Promise<{ sessionId: string; lastMessage: string; timestamp: Date }[]> {
    const results = await db.execute(sql`
      SELECT ac.session_id, ac.content, ac.timestamp
      FROM ai_conversations ac
      INNER JOIN (
        SELECT session_id, MAX(id) as max_id
        FROM ai_conversations
        WHERE role = 'user'
        GROUP BY session_id
      ) latest ON ac.id = latest.max_id
      ORDER BY ac.timestamp DESC
    `);
    return (results.rows as any[]).map(r => ({
      sessionId: r.session_id,
      lastMessage: r.content,
      timestamp: new Date(typeof r.timestamp === "number" ? r.timestamp * 1000 : r.timestamp),
    }));
  }

  async addAiMessage(message: InsertAiConversation): Promise<AiConversation> {
    const [result] = await db.insert(aiConversations).values(message).returning();
    return result;
  }

  async clearAiSession(sessionId: string): Promise<void> {
    await db.delete(aiConversations).where(eq(aiConversations.sessionId, sessionId));
  }

  // --- AI Config (singleton) ---

  async getAiConfig(): Promise<AiConfig | null> {
    const results = await db.select().from(aiConfig).limit(1);
    return results[0] || null;
  }

  // Upserts the AI config — updates the existing row if one exists, otherwise inserts.
  async setAiConfig(config: InsertAiConfig): Promise<AiConfig> {
    const existing = await this.getAiConfig();
    if (existing) {
      const [result] = await db.update(aiConfig).set(config).where(eq(aiConfig.id, existing.id)).returning();
      return result;
    }
    const [result] = await db.insert(aiConfig).values(config).returning();
    return result;
  }

  // --- Webhook Config CRUD ---
  // The events field is stored as a JSON string in SQLite.
  // We parse it on read and serialize on write.

  async getWebhookConfigs(): Promise<WebhookConfig[]> {
    const rows = await db.select().from(webhookConfigs);
    return rows.map(r => ({ ...r, events: parseEvents(r.events as any) as any }));
  }

  async getWebhookConfig(id: number): Promise<WebhookConfig | null> {
    const [result] = await db.select().from(webhookConfigs).where(eq(webhookConfigs.id, id));
    if (!result) return null;
    return { ...result, events: parseEvents(result.events as any) as any };
  }

  async createWebhookConfig(config: InsertWebhookConfig): Promise<WebhookConfig> {
    const toInsert = { ...config, events: serializeEvents(config.events as any) };
    const [result] = await db.insert(webhookConfigs).values(toInsert as any).returning();
    return { ...result, events: parseEvents(result.events as any) as any };
  }

  async updateWebhookConfig(id: number, data: Partial<InsertWebhookConfig>): Promise<WebhookConfig | null> {
    const toUpdate = { ...data };
    if (toUpdate.events) {
      (toUpdate as any).events = serializeEvents(toUpdate.events as any);
    }
    const [result] = await db.update(webhookConfigs).set(toUpdate as any).where(eq(webhookConfigs.id, id)).returning();
    if (!result) return null;
    return { ...result, events: parseEvents(result.events as any) as any };
  }

  async deleteWebhookConfig(id: number): Promise<boolean> {
    const result = await db.delete(webhookConfigs).where(eq(webhookConfigs.id, id)).returning();
    return result.length > 0;
  }

  // Filters enabled webhooks whose events include the given event string.
  async getEnabledWebhooksForEvent(event: string): Promise<WebhookConfig[]> {
    const all = await db.select().from(webhookConfigs).where(eq(webhookConfigs.enabled, true));
    return all
      .map(r => ({ ...r, events: parseEvents(r.events as any) as any }))
      .filter(w => w.events && w.events.includes(event));
  }
}

// Singleton storage instance used throughout the application
export const storage = new DatabaseStorage();
