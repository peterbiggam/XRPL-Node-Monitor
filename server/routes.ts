import type { Express, Request, Response } from "express";
import type { Server } from "http";
import WebSocket from "ws";
import si from "systeminformation";
import { storage } from "./storage";
import { connectionConfigSchema } from "@shared/schema";
import type { NodeInfo, LedgerInfo, PeerInfo, TransactionInfo, SystemMetrics, AccountInfo, FeeInfo, ValidatorInfo, AmendmentInfo } from "@shared/schema";
import { log } from "./index";

function getWsUrl(host: string, port: number): string {
  return `ws://${host}:${port}`;
}

async function sendXrplCommand(host: string, port: number, command: Record<string, unknown>): Promise<any> {
  const FALLBACK_PORTS = [6006, 5005, 8080];
  const portsToTry = [port, ...FALLBACK_PORTS.filter(p => p !== port)];

  let lastError: Error | null = null;

  for (const p of portsToTry) {
    try {
      const result = await sendXrplCommandToPort(host, p, command);
      return result;
    } catch (err: any) {
      lastError = err;
    }
  }

  throw lastError || new Error("Failed to connect to XRPL node");
}

function sendXrplCommandToPort(host: string, port: number, command: Record<string, unknown>): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = getWsUrl(host, port);
    const ws = new WebSocket(url, { handshakeTimeout: 5000 });
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error(`Connection to ${url} timed out`));
    }, 10000);

    ws.on("open", () => {
      ws.send(JSON.stringify(command));
    });

    ws.on("message", (data: WebSocket.Data) => {
      clearTimeout(timeout);
      try {
        const parsed = JSON.parse(data.toString());
        ws.close();
        resolve(parsed);
      } catch {
        ws.close();
        reject(new Error("Failed to parse XRPL response"));
      }
    });

    ws.on("error", (err: Error) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/connection", async (_req, res) => {
    const config = await storage.getConnectionConfig();
    res.json(config);
  });

  app.post("/api/connection", async (req, res) => {
    const parsed = connectionConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid connection config", errors: parsed.error.errors });
    }
    const config = await storage.setConnectionConfig(parsed.data);
    res.json(config);
  });

  app.get("/api/node/info", async (_req, res) => {
    try {
      const config = await storage.getConnectionConfig();
      const response = await sendXrplCommand(config.host, config.wsPort, {
        command: "server_info",
      });

      if (response.result && response.result.info) {
        const info = response.result.info;
        const nodeInfo: NodeInfo = {
          buildVersion: info.build_version || "",
          completeLedgers: info.complete_ledgers || "",
          hostId: info.hostid || "",
          initialSyncDurationUs: info.initial_sync_duration_us || "0",
          ioLatencyMs: info.io_latency_ms || 0,
          jqTransOverflow: info.jq_trans_overflow || "0",
          lastClose: {
            convergeTimeS: info.last_close?.converge_time_s || 0,
            proposers: info.last_close?.proposers || 0,
          },
          loadFactor: info.load_factor || 1,
          peerDisconnects: info.peer_disconnects || "0",
          peerDisconnectsResources: info.peer_disconnects_resources || "0",
          peers: info.peers || 0,
          pubkeyNode: info.pubkey_node || "",
          serverState: info.server_state || "unknown",
          serverStateDurationUs: info.server_state_duration_us || "0",
          stateAccounting: info.state_accounting || {},
          time: info.time || "",
          uptime: info.uptime || 0,
          validatedLedger: {
            age: info.validated_ledger?.age || 0,
            baseFee: info.validated_ledger?.base_fee_xrp || 0,
            hash: info.validated_ledger?.hash || "",
            reserveBase: info.validated_ledger?.reserve_base_xrp || 0,
            reserveInc: info.validated_ledger?.reserve_inc_xrp || 0,
            seq: info.validated_ledger?.seq || 0,
          },
          validationQuorum: info.validation_quorum || 0,
        };
        res.json({ status: "connected", data: nodeInfo });
      } else {
        res.json({ status: "error", message: "Unexpected response format", data: null });
      }
    } catch (err: any) {
      res.json({ status: "disconnected", message: err.message || "Failed to connect to XRPL node", data: null });
    }
  });

  app.get("/api/node/ledger", async (_req, res) => {
    try {
      const config = await storage.getConnectionConfig();
      const response = await sendXrplCommand(config.host, config.wsPort, {
        command: "ledger",
        ledger_index: "validated",
        transactions: true,
        expand: false,
      });

      if (response.result && response.result.ledger) {
        const ledger = response.result.ledger;
        const ledgerInfo: LedgerInfo = {
          ledgerIndex: parseInt(ledger.ledger_index || ledger.seqNum || "0"),
          ledgerHash: ledger.ledger_hash || ledger.hash || "",
          closeTime: ledger.close_time || 0,
          closeTimeHuman: ledger.close_time_human || "",
          parentHash: ledger.parent_hash || "",
          totalCoins: ledger.total_coins || "0",
          transactionCount: Array.isArray(ledger.transactions) ? ledger.transactions.length : 0,
          accountHash: ledger.account_hash || "",
          txHash: ledger.transaction_hash || "",
        };
        res.json({ status: "connected", data: ledgerInfo });
      } else {
        res.json({ status: "error", message: "Unexpected response format", data: null });
      }
    } catch (err: any) {
      res.json({ status: "disconnected", message: err.message || "Failed to connect", data: null });
    }
  });

  app.get("/api/node/peers", async (_req, res) => {
    try {
      const config = await storage.getConnectionConfig();
      const response = await sendXrplCommand(config.host, config.adminPort, {
        command: "peers",
      });

      if (response.result && response.result.peers) {
        const peers: PeerInfo[] = response.result.peers.map((p: any) => ({
          address: p.address || "",
          completeLedgers: p.complete_ledgers || "",
          latency: p.latency || 0,
          ledgerHash: p.ledger || "",
          inbound: p.inbound === true,
          publicKey: p.public_key || "",
          uptime: p.uptime || 0,
          version: p.version || "",
          sanity: p.sanity || "unknown",
        }));
        res.json({ status: "connected", data: peers });
      } else {
        res.json({ status: "connected", data: [] });
      }
    } catch (err: any) {
      res.json({ status: "disconnected", message: err.message || "Failed to connect", data: null });
    }
  });

  app.get("/api/node/transactions", async (_req, res) => {
    try {
      const config = await storage.getConnectionConfig();
      const ledgerResponse = await sendXrplCommand(config.host, config.wsPort, {
        command: "ledger",
        ledger_index: "validated",
        transactions: true,
        expand: true,
      });

      if (ledgerResponse.result && ledgerResponse.result.ledger) {
        const ledger = ledgerResponse.result.ledger;
        const txs: TransactionInfo[] = [];

        if (Array.isArray(ledger.transactions)) {
          for (const tx of ledger.transactions) {
            const txData = tx.tx || tx;
            const meta = tx.meta || tx.metaData || {};
            txs.push({
              hash: txData.hash || tx.hash || "",
              type: txData.TransactionType || "Unknown",
              account: txData.Account || "",
              destination: txData.Destination || undefined,
              amount: typeof txData.Amount === "string" ? txData.Amount : txData.Amount?.value || undefined,
              fee: txData.Fee || "0",
              result: meta.TransactionResult || "unknown",
              ledgerIndex: parseInt(ledger.ledger_index || "0"),
              date: ledger.close_time || 0,
            });
          }
        }

        res.json({ status: "connected", data: txs });
      } else {
        res.json({ status: "error", message: "Unexpected response format", data: [] });
      }
    } catch (err: any) {
      res.json({ status: "disconnected", message: err.message || "Failed to connect", data: [] });
    }
  });

  app.get("/api/system/metrics", async (_req, res) => {
    try {
      const [cpuLoad, cpuInfo, mem, disk, networkStats, osInfo, timeData] = await Promise.all([
        si.currentLoad(),
        si.cpu(),
        si.mem(),
        si.fsSize(),
        si.networkStats(),
        si.osInfo(),
        si.time(),
      ]);

      const metrics: SystemMetrics = {
        cpu: {
          currentLoad: Math.round(cpuLoad.currentLoad * 100) / 100,
          avgLoad: cpuLoad.avgLoad || 0,
          cores: cpuInfo.cores || 0,
          model: cpuInfo.manufacturer + " " + cpuInfo.brand,
        },
        memory: {
          total: mem.total,
          used: mem.used,
          free: mem.free,
          usedPercent: Math.round((mem.used / mem.total) * 10000) / 100,
        },
        disk: disk.map((d) => ({
          fs: d.fs,
          size: d.size,
          used: d.used,
          available: d.available,
          usedPercent: Math.round(d.use * 100) / 100,
          mount: d.mount,
        })),
        network: networkStats.map((n) => ({
          iface: n.iface,
          rxBytes: n.rx_bytes,
          txBytes: n.tx_bytes,
          rxSec: Math.round((n.rx_sec || 0) * 100) / 100,
          txSec: Math.round((n.tx_sec || 0) * 100) / 100,
        })),
        uptime: timeData.uptime,
        os: {
          platform: osInfo.platform,
          hostname: osInfo.hostname,
          kernel: osInfo.kernel,
          arch: osInfo.arch,
        },
      };

      res.json(metrics);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to get system metrics", error: err.message });
    }
  });

  // === T002: Metrics Snapshot Collection ===
  async function collectMetricsSnapshot() {
    try {
      const config = await storage.getConnectionConfig();
      let nodeData: Partial<{ peerCount: number; ledgerIndex: number; closeTimeMs: number; loadFactor: number; serverState: string }> = {};

      try {
        const response = await sendXrplCommand(config.host, config.wsPort, { command: "server_info" });
        if (response.result?.info) {
          const info = response.result.info;
          nodeData = {
            peerCount: info.peers || 0,
            ledgerIndex: info.validated_ledger?.seq || 0,
            closeTimeMs: (info.last_close?.converge_time_s || 0) * 1000,
            loadFactor: info.load_factor || 1,
            serverState: info.server_state || "unknown",
          };
        }
      } catch {}

      let cpuLoad = 0;
      let memPercent = 0;
      try {
        const [cpu, mem] = await Promise.all([si.currentLoad(), si.mem()]);
        cpuLoad = Math.round(cpu.currentLoad * 100) / 100;
        memPercent = Math.round((mem.used / mem.total) * 10000) / 100;
      } catch {}

      await storage.addMetricsSnapshot({
        nodeHost: config.host,
        cpuLoad,
        memoryPercent: memPercent,
        peerCount: nodeData.peerCount ?? null,
        ledgerIndex: nodeData.ledgerIndex ?? null,
        closeTimeMs: nodeData.closeTimeMs ?? null,
        loadFactor: nodeData.loadFactor ?? null,
        serverState: nodeData.serverState ?? null,
      });

      await storage.cleanOldMetrics(7);

      // === T004: Alert checking ===
      await checkAlerts(cpuLoad, memPercent, nodeData);
    } catch (err: any) {
      log(`Metrics snapshot error: ${err.message}`, "metrics");
    }
  }

  // === T004: Alert Detection Engine ===
  async function checkAlerts(cpuLoad: number, memPercent: number, nodeData: any) {
    try {
      const thresholds = await storage.getAlertThresholds();

      for (const t of thresholds) {
        if (!t.enabled) continue;

        let currentValue: number | null = null;
        let label = "";

        switch (t.metric) {
          case "cpu":
            currentValue = cpuLoad;
            label = "CPU Load";
            break;
          case "memory":
            currentValue = memPercent;
            label = "Memory Usage";
            break;
          case "peers":
            currentValue = nodeData.peerCount ?? null;
            label = "Peer Count";
            break;
          case "ledger_age":
            currentValue = nodeData.closeTimeMs != null ? nodeData.closeTimeMs / 1000 : null;
            label = "Ledger Close Time";
            break;
        }

        if (currentValue === null) continue;

        const isAbove = t.direction === "above";
        const isCritical = isAbove ? currentValue >= t.criticalValue : currentValue <= t.criticalValue;
        const isWarning = isAbove ? currentValue >= t.warningValue : currentValue <= t.warningValue;

        if (isCritical || isWarning) {
          const severity = isCritical ? "critical" : "warning";
          const recent = await storage.getRecentAlertByType(t.metric, 5);
          if (!recent) {
            const direction = isAbove ? "exceeded" : "dropped below";
            const threshold = isCritical ? t.criticalValue : t.warningValue;
            await storage.createAlert({
              type: t.metric,
              severity,
              message: `${label} ${direction} ${severity} threshold: ${currentValue.toFixed(1)} (threshold: ${threshold})`,
              value: currentValue,
              threshold,
            });
          }
        }
      }
    } catch (err: any) {
      log(`Alert check error: ${err.message}`, "alerts");
    }
  }

  await storage.seedDefaultThresholds();
  setInterval(collectMetricsSnapshot, 30000);
  collectMetricsSnapshot();

  app.get("/api/metrics/history", async (req: Request, res: Response) => {
    const hours = parseInt(req.query.hours as string) || 24;
    const data = await storage.getMetricsHistory(hours);
    res.json(data);
  });

  // === T004: Alert API endpoints ===
  app.get("/api/alerts", async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 100;
    const data = await storage.getAlerts(limit);
    res.json(data);
  });

  app.get("/api/alerts/unacknowledged", async (_req: Request, res: Response) => {
    const data = await storage.getUnacknowledgedAlerts();
    res.json(data);
  });

  app.get("/api/alerts/thresholds", async (_req: Request, res: Response) => {
    const data = await storage.getAlertThresholds();
    res.json(data);
  });

  app.put("/api/alerts/thresholds/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const result = await storage.updateAlertThreshold(id, req.body);
    if (!result) return res.status(404).json({ message: "Threshold not found" });
    res.json(result);
  });

  app.post("/api/alerts/:id/acknowledge", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const result = await storage.acknowledgeAlert(id);
    if (!result) return res.status(404).json({ message: "Alert not found" });
    res.json(result);
  });

  // === T006: Transaction Search + Account Lookup ===
  app.get("/api/node/tx/:hash", async (req: Request, res: Response) => {
    try {
      const config = await storage.getConnectionConfig();
      const response = await sendXrplCommand(config.host, config.wsPort, {
        command: "tx",
        transaction: req.params.hash,
      });

      if (response.result) {
        const tx = response.result;
        const meta = tx.meta || {};
        res.json({
          status: "connected",
          data: {
            hash: tx.hash || req.params.hash,
            type: tx.TransactionType || "Unknown",
            account: tx.Account || "",
            destination: tx.Destination || undefined,
            amount: typeof tx.Amount === "string" ? tx.Amount : tx.Amount?.value || undefined,
            fee: tx.Fee || "0",
            result: meta.TransactionResult || tx.validated ? "tesSUCCESS" : "unknown",
            ledgerIndex: tx.ledger_index || tx.inLedger || 0,
            date: tx.date || 0,
            raw: tx,
          },
        });
      } else {
        res.json({ status: "error", message: response.error_message || "Transaction not found", data: null });
      }
    } catch (err: any) {
      res.json({ status: "disconnected", message: err.message, data: null });
    }
  });

  app.get("/api/node/account/:address", async (req: Request, res: Response) => {
    try {
      const config = await storage.getConnectionConfig();
      const response = await sendXrplCommand(config.host, config.wsPort, {
        command: "account_info",
        account: req.params.address,
        ledger_index: "validated",
      });

      if (response.result?.account_data) {
        const acct = response.result.account_data;
        const accountInfo: AccountInfo = {
          address: acct.Account || req.params.address,
          balance: acct.Balance || "0",
          sequence: acct.Sequence || 0,
          ownerCount: acct.OwnerCount || 0,
          previousTxnID: acct.PreviousTxnID || "",
          flags: acct.Flags || 0,
        };
        res.json({ status: "connected", data: accountInfo });
      } else {
        res.json({ status: "error", message: response.error_message || "Account not found", data: null });
      }
    } catch (err: any) {
      res.json({ status: "disconnected", message: err.message, data: null });
    }
  });

  app.get("/api/node/account/:address/transactions", async (req: Request, res: Response) => {
    try {
      const config = await storage.getConnectionConfig();
      const response = await sendXrplCommand(config.host, config.wsPort, {
        command: "account_tx",
        account: req.params.address,
        ledger_index_min: -1,
        ledger_index_max: -1,
        limit: 20,
      });

      if (response.result?.transactions) {
        const txs: TransactionInfo[] = response.result.transactions.map((t: any) => {
          const tx = t.tx || t;
          const meta = t.meta || {};
          return {
            hash: tx.hash || "",
            type: tx.TransactionType || "Unknown",
            account: tx.Account || "",
            destination: tx.Destination || undefined,
            amount: typeof tx.Amount === "string" ? tx.Amount : tx.Amount?.value || undefined,
            fee: tx.Fee || "0",
            result: meta.TransactionResult || "unknown",
            ledgerIndex: tx.ledger_index || 0,
            date: tx.date || 0,
          };
        });
        res.json({ status: "connected", data: txs });
      } else {
        res.json({ status: "error", message: "No transactions found", data: [] });
      }
    } catch (err: any) {
      res.json({ status: "disconnected", message: err.message, data: [] });
    }
  });

  app.get("/api/node/fee", async (_req: Request, res: Response) => {
    try {
      const config = await storage.getConnectionConfig();
      const response = await sendXrplCommand(config.host, config.wsPort, { command: "fee" });

      if (response.result) {
        const drops = response.result.drops || {};
        const feeInfo: FeeInfo = {
          currentLedgerSize: response.result.current_ledger_size || 0,
          expectedLedgerSize: response.result.expected_ledger_size || 0,
          maxQueueSize: response.result.max_queue_size || 0,
          medianFee: drops.median_fee || "0",
          minimumFee: drops.minimum_fee || "0",
          openLedgerFee: drops.open_ledger_fee || "0",
        };
        res.json({ status: "connected", data: feeInfo });
      } else {
        res.json({ status: "error", message: "Fee data unavailable", data: null });
      }
    } catch (err: any) {
      res.json({ status: "disconnected", message: err.message, data: null });
    }
  });

  // === T009: Validator + Amendment Endpoints ===
  app.get("/api/node/validators", async (_req: Request, res: Response) => {
    try {
      const config = await storage.getConnectionConfig();
      const response = await sendXrplCommand(config.host, config.adminPort, {
        command: "validators",
      });

      if (response.result) {
        const validators: ValidatorInfo[] = (response.result.trusted_validators || response.result.validators || []).map((v: any) => ({
          publicKey: v.validation_public_key || v.pubkey_validator || "",
          signingKey: v.signing_key || undefined,
          masterKey: v.master_key || undefined,
          domain: v.domain || undefined,
          agreement: v.agreement || undefined,
          partial: v.partial || false,
          unl: v.unl !== false,
        }));
        res.json({
          status: "connected",
          data: validators,
          publisherCount: response.result.publisher_lists?.length || 0,
          localValidator: response.result.local_static_keys || [],
        });
      } else {
        res.json({ status: "connected", data: [] });
      }
    } catch (err: any) {
      res.json({ status: "disconnected", message: err.message, data: [] });
    }
  });

  app.get("/api/node/amendments", async (_req: Request, res: Response) => {
    try {
      const config = await storage.getConnectionConfig();
      const response = await sendXrplCommand(config.host, config.adminPort, {
        command: "feature",
      });

      if (response.result) {
        const amendments: AmendmentInfo[] = Object.entries(response.result).map(([id, data]: [string, any]) => ({
          name: data.name || id.substring(0, 16) + "...",
          id,
          enabled: data.enabled === true,
          supported: data.supported === true,
          vetoed: data.vetoed === true || data.vetoed === "Obsolete",
          count: data.count || undefined,
          threshold: data.threshold || undefined,
        }));
        res.json({ status: "connected", data: amendments });
      } else {
        res.json({ status: "connected", data: [] });
      }
    } catch (err: any) {
      res.json({ status: "disconnected", message: err.message, data: [] });
    }
  });

  app.get("/api/node/validator-info", async (_req: Request, res: Response) => {
    try {
      const config = await storage.getConnectionConfig();
      const response = await sendXrplCommand(config.host, config.adminPort, {
        command: "validator_info",
      });

      if (response.result) {
        res.json({ status: "connected", data: response.result });
      } else {
        res.json({ status: "connected", data: null, message: "Not a validator node" });
      }
    } catch (err: any) {
      res.json({ status: "disconnected", message: err.message, data: null });
    }
  });

  // === T011: Multi-Node Management ===
  app.get("/api/nodes", async (_req: Request, res: Response) => {
    const nodes = await storage.getSavedNodes();
    res.json(nodes);
  });

  app.post("/api/nodes", async (req: Request, res: Response) => {
    const { name, host, wsPort, httpPort, adminPort } = req.body;
    if (!name || !host) return res.status(400).json({ message: "Name and host are required" });
    const node = await storage.createSavedNode({
      name,
      host,
      wsPort: wsPort || 6006,
      httpPort: httpPort || 5005,
      adminPort: adminPort || 8080,
    });
    res.json(node);
  });

  app.put("/api/nodes/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const result = await storage.updateSavedNode(id, req.body);
    if (!result) return res.status(404).json({ message: "Node not found" });
    res.json(result);
  });

  app.delete("/api/nodes/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const deleted = await storage.deleteSavedNode(id);
    if (!deleted) return res.status(404).json({ message: "Node not found" });
    res.json({ success: true });
  });

  app.post("/api/nodes/:id/activate", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const node = await storage.setActiveNode(id);
    if (!node) return res.status(404).json({ message: "Node not found" });
    res.json(node);
  });

  app.get("/api/nodes/:id/status", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const node = await storage.getSavedNode(id);
    if (!node) return res.status(404).json({ message: "Node not found" });

    try {
      const response = await sendXrplCommandToPort(node.host, node.wsPort, { command: "server_info" });
      if (response.result?.info) {
        res.json({
          status: "connected",
          serverState: response.result.info.server_state,
          peers: response.result.info.peers,
          ledgerSeq: response.result.info.validated_ledger?.seq,
        });
      } else {
        res.json({ status: "error" });
      }
    } catch {
      res.json({ status: "disconnected" });
    }
  });

  // === T013: LM Studio AI Integration ===
  app.get("/api/ai/config", async (_req: Request, res: Response) => {
    const config = await storage.getAiConfig();
    res.json(config || { host: "localhost", port: 1234, model: "" });
  });

  app.post("/api/ai/config", async (req: Request, res: Response) => {
    const { host, port, model } = req.body;
    const config = await storage.setAiConfig({
      host: host || "localhost",
      port: port || 1234,
      model: model || "",
    });
    res.json(config);
  });

  app.post("/api/ai/health-check", async (req: Request, res: Response) => {
    const config = await storage.getAiConfig();
    const host = config?.host || "localhost";
    const port = config?.port || 1234;

    try {
      const response = await fetch(`http://${host}:${port}/v1/models`);
      if (response.ok) {
        const data = await response.json();
        res.json({ status: "connected", models: data.data || [] });
      } else {
        res.json({ status: "error", message: `HTTP ${response.status}` });
      }
    } catch (err: any) {
      res.json({ status: "disconnected", message: err.message });
    }
  });

  app.get("/api/ai/sessions", async (_req: Request, res: Response) => {
    const sessions = await storage.getAiSessions();
    res.json(sessions);
  });

  app.get("/api/ai/history/:sessionId", async (req: Request, res: Response) => {
    const messages = await storage.getAiConversations(req.params.sessionId);
    res.json(messages);
  });

  app.delete("/api/ai/session/:sessionId", async (req: Request, res: Response) => {
    await storage.clearAiSession(req.params.sessionId);
    res.json({ success: true });
  });

  app.post("/api/ai/analyze", async (req: Request, res: Response) => {
    const { message, sessionId, context } = req.body;
    if (!message) return res.status(400).json({ message: "Message is required" });

    const config = await storage.getAiConfig();
    const host = config?.host || "localhost";
    const port = config?.port || 1234;
    const model = config?.model || "";
    const sid = sessionId || `session-${Date.now()}`;

    let contextData = "";
    try {
      const connConfig = await storage.getConnectionConfig();
      if (context === "node" || context === "general") {
        try {
          const nodeResp = await sendXrplCommand(connConfig.host, connConfig.wsPort, { command: "server_info" });
          if (nodeResp.result?.info) {
            const i = nodeResp.result.info;
            contextData += `\n[Node Status] State: ${i.server_state}, Uptime: ${i.uptime}s, Peers: ${i.peers}, Build: ${i.build_version}, Load Factor: ${i.load_factor}, Ledger: ${i.validated_ledger?.seq}, Quorum: ${i.validation_quorum}`;
          }
        } catch {}
      }
      if (context === "ledger" || context === "general") {
        try {
          const ledgerResp = await sendXrplCommand(connConfig.host, connConfig.wsPort, { command: "ledger", ledger_index: "validated" });
          if (ledgerResp.result?.ledger) {
            const l = ledgerResp.result.ledger;
            contextData += `\n[Latest Ledger] Index: ${l.ledger_index}, Hash: ${l.ledger_hash}, Close Time: ${l.close_time_human}, Txns: ${l.transactions?.length || 0}`;
          }
        } catch {}
      }
      if (context === "peers" || context === "general") {
        try {
          const peersResp = await sendXrplCommand(connConfig.host, connConfig.adminPort, { command: "peers" });
          if (peersResp.result?.peers) {
            const peers = peersResp.result.peers;
            const inbound = peers.filter((p: any) => p.inbound).length;
            contextData += `\n[Peers] Total: ${peers.length}, Inbound: ${inbound}, Outbound: ${peers.length - inbound}`;
          }
        } catch {}
      }
      if (context === "system" || context === "general") {
        try {
          const [cpu, mem] = await Promise.all([si.currentLoad(), si.mem()]);
          contextData += `\n[System] CPU: ${cpu.currentLoad.toFixed(1)}%, Memory: ${((mem.used / mem.total) * 100).toFixed(1)}%`;
        } catch {}
      }
      if (context === "alerts" || context === "general") {
        try {
          const recentAlerts = await storage.getAlerts(10);
          if (recentAlerts.length > 0) {
            contextData += `\n[Recent Alerts] ${recentAlerts.map(a => `${a.severity}: ${a.message}`).join("; ")}`;
          }
        } catch {}
      }
    } catch {}

    await storage.addAiMessage({ sessionId: sid, role: "user", content: message, context: context || null });

    const systemPrompt = `You are an XRPL Node Monitoring AI Assistant. You help analyze XRP Ledger node health, network performance, and provide insights about the node's operation. Be concise but thorough. Use technical XRPL terminology when appropriate.${contextData ? `\n\nCurrent Node Data:${contextData}` : ""}`;

    const previousMessages = await storage.getAiConversations(sid);
    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...previousMessages.slice(-20).map(m => ({ role: m.role, content: m.content })),
    ];

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      const aiResponse = await fetch(`http://${host}:${port}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: chatMessages,
          stream: true,
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        res.write(`data: ${JSON.stringify({ error: `LM Studio error: ${aiResponse.status} - ${errText}` })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }

      let fullResponse = "";
      const reader = aiResponse.body as any;

      if (reader && typeof reader[Symbol.asyncIterator] === "function") {
        const decoder = new TextDecoder();
        for await (const chunk of reader) {
          const text = decoder.decode(chunk, { stream: true });
          const lines = text.split("\n").filter(l => l.startsWith("data: "));

          for (const line of lines) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") {
              await storage.addAiMessage({ sessionId: sid, role: "assistant", content: fullResponse, context: context || null });
              res.write("data: [DONE]\n\n");
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || "";
              if (content) {
                fullResponse += content;
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
              }
            } catch {}
          }
        }
      } else {
        const text = await aiResponse.text();
        try {
          const parsed = JSON.parse(text);
          fullResponse = parsed.choices?.[0]?.message?.content || "";
          res.write(`data: ${JSON.stringify({ content: fullResponse })}\n\n`);
        } catch {
          fullResponse = "Failed to parse AI response";
          res.write(`data: ${JSON.stringify({ error: fullResponse })}\n\n`);
        }
        await storage.addAiMessage({ sessionId: sid, role: "assistant", content: fullResponse, context: context || null });
        res.write("data: [DONE]\n\n");
      }

      res.end();
    } catch (err: any) {
      res.write(`data: ${JSON.stringify({ error: `Failed to connect to LM Studio: ${err.message}` })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    }
  });

  // === T017: Export & Reporting ===
  app.get("/api/export/report", async (req: Request, res: Response) => {
    const hours = parseInt(req.query.hours as string) || 24;
    const snapshots = await storage.getMetricsHistory(hours);
    const recentAlerts = await storage.getAlerts(100);

    if (snapshots.length === 0) {
      return res.json({ message: "No data available for the requested time range", snapshots: [], summary: null });
    }

    const cpuValues = snapshots.filter(s => s.cpuLoad != null).map(s => s.cpuLoad!);
    const memValues = snapshots.filter(s => s.memoryPercent != null).map(s => s.memoryPercent!);
    const peerValues = snapshots.filter(s => s.peerCount != null).map(s => s.peerCount!);

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const min = (arr: number[]) => arr.length > 0 ? Math.min(...arr) : 0;
    const max = (arr: number[]) => arr.length > 0 ? Math.max(...arr) : 0;

    const summary = {
      timeRange: `${hours} hours`,
      snapshotCount: snapshots.length,
      cpu: { avg: avg(cpuValues).toFixed(1), min: min(cpuValues).toFixed(1), max: max(cpuValues).toFixed(1) },
      memory: { avg: avg(memValues).toFixed(1), min: min(memValues).toFixed(1), max: max(memValues).toFixed(1) },
      peers: { avg: avg(peerValues).toFixed(0), min: min(peerValues), max: max(peerValues) },
      alertCount: recentAlerts.length,
      criticalAlerts: recentAlerts.filter(a => a.severity === "critical").length,
    };

    const format = req.query.format as string;
    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=xrpl-metrics-${hours}h.csv`);
      const headers = "timestamp,cpu_load,memory_percent,peer_count,ledger_index,load_factor,server_state\n";
      const rows = snapshots.map(s =>
        `${s.timestamp},${s.cpuLoad ?? ""},${s.memoryPercent ?? ""},${s.peerCount ?? ""},${s.ledgerIndex ?? ""},${s.loadFactor ?? ""},${s.serverState ?? ""}`
      ).join("\n");
      return res.send(headers + rows);
    }

    res.json({ summary, snapshots, alerts: recentAlerts });
  });

  return httpServer;
}
