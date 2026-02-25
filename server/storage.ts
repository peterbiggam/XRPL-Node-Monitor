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
  metricsSnapshots,
  alerts,
  alertThresholds,
  savedNodes,
  aiConversations,
  aiConfig,
} from "@shared/schema";

export interface IStorage {
  getConnectionConfig(): Promise<ConnectionConfig>;
  setConnectionConfig(config: ConnectionConfig): Promise<ConnectionConfig>;

  addMetricsSnapshot(snapshot: InsertMetricsSnapshot): Promise<MetricsSnapshot>;
  getMetricsHistory(hours: number): Promise<MetricsSnapshot[]>;
  cleanOldMetrics(days: number): Promise<void>;

  getAlerts(limit?: number): Promise<Alert[]>;
  getUnacknowledgedAlerts(): Promise<Alert[]>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  acknowledgeAlert(id: number): Promise<Alert | null>;
  getRecentAlertByType(type: string, minutes: number): Promise<Alert | null>;

  getAlertThresholds(): Promise<AlertThreshold[]>;
  getAlertThreshold(id: number): Promise<AlertThreshold | null>;
  updateAlertThreshold(id: number, data: Partial<InsertAlertThreshold>): Promise<AlertThreshold | null>;
  seedDefaultThresholds(): Promise<void>;

  getSavedNodes(): Promise<SavedNode[]>;
  getSavedNode(id: number): Promise<SavedNode | null>;
  createSavedNode(node: InsertSavedNode): Promise<SavedNode>;
  updateSavedNode(id: number, data: Partial<InsertSavedNode>): Promise<SavedNode | null>;
  deleteSavedNode(id: number): Promise<boolean>;
  setActiveNode(id: number): Promise<SavedNode | null>;
  getActiveNode(): Promise<SavedNode | null>;

  getAiConversations(sessionId: string): Promise<AiConversation[]>;
  getAiSessions(): Promise<{ sessionId: string; lastMessage: string; timestamp: Date }[]>;
  addAiMessage(message: InsertAiConversation): Promise<AiConversation>;
  clearAiSession(sessionId: string): Promise<void>;

  getAiConfig(): Promise<AiConfig | null>;
  setAiConfig(config: InsertAiConfig): Promise<AiConfig>;
}

export class DatabaseStorage implements IStorage {
  private connectionConfig: ConnectionConfig;

  constructor() {
    this.connectionConfig = {
      host: "localhost",
      wsPort: 6006,
      httpPort: 5005,
      adminPort: 8080,
    };
  }

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

  async getMetricsHistory(hours: number): Promise<MetricsSnapshot[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    return db.select().from(metricsSnapshots).where(gte(metricsSnapshots.timestamp, since)).orderBy(metricsSnapshots.timestamp);
  }

  async cleanOldMetrics(days: number): Promise<void> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    await db.delete(metricsSnapshots).where(sql`${metricsSnapshots.timestamp} < ${cutoff}`);
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

  async getAiConversations(sessionId: string): Promise<AiConversation[]> {
    return db.select().from(aiConversations)
      .where(eq(aiConversations.sessionId, sessionId))
      .orderBy(aiConversations.timestamp);
  }

  async getAiSessions(): Promise<{ sessionId: string; lastMessage: string; timestamp: Date }[]> {
    const results = await db.execute(sql`
      SELECT DISTINCT ON (session_id) session_id, content, timestamp
      FROM ai_conversations
      WHERE role = 'user'
      ORDER BY session_id, timestamp DESC
    `);
    return (results.rows as any[]).map(r => ({
      sessionId: r.session_id,
      lastMessage: r.content,
      timestamp: new Date(r.timestamp),
    }));
  }

  async addAiMessage(message: InsertAiConversation): Promise<AiConversation> {
    const [result] = await db.insert(aiConversations).values(message).returning();
    return result;
  }

  async clearAiSession(sessionId: string): Promise<void> {
    await db.delete(aiConversations).where(eq(aiConversations.sessionId, sessionId));
  }

  async getAiConfig(): Promise<AiConfig | null> {
    const results = await db.select().from(aiConfig).limit(1);
    return results[0] || null;
  }

  async setAiConfig(config: InsertAiConfig): Promise<AiConfig> {
    const existing = await this.getAiConfig();
    if (existing) {
      const [result] = await db.update(aiConfig).set(config).where(eq(aiConfig.id, existing.id)).returning();
      return result;
    }
    const [result] = await db.insert(aiConfig).values(config).returning();
    return result;
  }
}

export const storage = new DatabaseStorage();
