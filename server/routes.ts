// API route registration and background services (metrics collector, alert engine).
// All XRPL communication goes through ephemeral WebSocket connections to the configured node.

import type { Express, Request, Response } from "express";
import type { Server } from "http";
import WebSocket from "ws";
import si from "systeminformation";
import { storage } from "./storage";
import { connectionConfigSchema } from "@shared/schema";
import type { NodeInfo, LedgerInfo, PeerInfo, TransactionInfo, SystemMetrics, AccountInfo, FeeInfo, ValidatorInfo, AmendmentInfo } from "@shared/schema";
import { log } from "./index";

// --- XRPL WebSocket helpers ---

// Constructs a WebSocket URL from host and port
function getWsUrl(host: string, port: number): string {
  return `ws://${host}:${port}`;
}

// Sends a single XRPL command via WebSocket with automatic port fallback.
// Tries the requested port first, then falls back to common rippled ports
// (6006, 5005, 8080) in case the node uses a non-standard configuration.
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

// Opens a one-shot WebSocket connection, sends the command, waits for a single
// response, then closes. Has a 5s handshake timeout and 10s overall timeout
// to avoid hanging on unreachable nodes.
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

// --- Route Registration ---

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // === Connection Config ===
  // GET/POST the XRPL node connection target (host + ports)

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

  // === Node Info ===
  // Fetches server_info from the XRPL node and normalizes it into our NodeInfo shape.
  // Returns { status: "connected"|"disconnected"|"error", data: NodeInfo|null }

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

  // === Ledger Info ===
  // Returns the latest validated ledger's metadata (hash, close time, tx count, etc.)

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

  // === Peers ===
  // Requires admin port. Returns connected peer details (address, version, latency, etc.)

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

  // === Transactions ===
  // Fetches expanded transactions from the latest validated ledger

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

  // === System Metrics ===
  // Returns host machine stats (CPU, RAM, disk, network) via the systeminformation library.
  // This is the *host* system, not the XRPL node itself.

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

  // === Webhook Dispatcher ===
  // Sends alert notifications to all enabled webhooks subscribed to the given event.
  // Supports Discord embeds, Telegram bot API, and generic JSON POST webhooks.
  // Failures are logged but never propagated — webhooks are fire-and-forget.
  async function fireWebhooks(event: string, message: string, severity?: string) {
    try {
      const webhooks = await storage.getEnabledWebhooksForEvent(event);
      for (const wh of webhooks) {
        try {
          if (wh.type === "discord") {
            const color = severity === "critical" ? 0xFF0000 : severity === "warning" ? 0xFFAA00 : 0x00E6FF;
            await fetch(wh.url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                embeds: [{
                  title: `XRPL Node Alert — ${severity?.toUpperCase() || "INFO"}`,
                  description: message,
                  color,
                  timestamp: new Date().toISOString(),
                  footer: { text: "XRPL Node Monitor" },
                }],
              }),
            });
          } else if (wh.type === "telegram") {
            // Telegram webhook URL format: "botToken|chatId"
            const [botToken, chatId] = wh.url.split("|");
            if (botToken && chatId) {
              await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: chatId, text: `⚠️ XRPL Alert [${severity?.toUpperCase()}]\n${message}`, parse_mode: "HTML" }),
              });
            }
          } else {
            // Generic JSON webhook
            await fetch(wh.url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ event, message, severity, timestamp: new Date().toISOString(), source: "xrpl-node-monitor" }),
            });
          }
        } catch (err: any) {
          log(`Webhook ${wh.name} failed: ${err.message}`, "webhooks");
        }
      }
    } catch {}
  }

  // Tracks the previous ledger index and timestamp for TPS calculation.
  // TPS is estimated as: (tx count in latest ledger) / (seconds since last ledger change).
  let lastLedgerIndex = 0;
  let lastLedgerTime = Date.now();

  // === Metrics Snapshot Collector ===
  // Runs every 30 seconds. Gathers XRPL node state + host system stats,
  // persists a snapshot, prunes entries older than 7 days, then runs the alert engine.
  async function collectMetricsSnapshot() {
    try {
      const config = await storage.getConnectionConfig();
      let nodeData: Partial<{ peerCount: number; ledgerIndex: number; closeTimeMs: number; loadFactor: number; serverState: string; nodeLatencyMs: number; reserveBase: number; reserveInc: number; baseFee: number }> = {};

      // Fetch XRPL node info and measure WebSocket round-trip latency
      try {
        const startTime = Date.now();
        const response = await sendXrplCommand(config.host, config.wsPort, { command: "server_info" });
        const latencyMs = Date.now() - startTime;

        if (response.result?.info) {
          const info = response.result.info;
          nodeData = {
            peerCount: info.peers || 0,
            ledgerIndex: info.validated_ledger?.seq || 0,
            closeTimeMs: (info.last_close?.converge_time_s || 0) * 1000,
            loadFactor: info.load_factor || 1,
            serverState: info.server_state || "unknown",
            nodeLatencyMs: latencyMs,
            reserveBase: info.validated_ledger?.reserve_base_xrp || 0,
            reserveInc: info.validated_ledger?.reserve_inc_xrp || 0,
            baseFee: info.validated_ledger?.base_fee_xrp || 0,
          };
        }
      } catch {}

      // Estimate TPS: only calculated when the ledger has advanced since last check
      let tps: number | null = null;
      const currentLedger = nodeData.ledgerIndex || 0;
      const now = Date.now();
      if (lastLedgerIndex > 0 && currentLedger > lastLedgerIndex) {
        const elapsedSec = (now - lastLedgerTime) / 1000;
        if (elapsedSec > 0) {
          try {
            const config2 = await storage.getConnectionConfig();
            const ledgerResp = await sendXrplCommand(config2.host, config2.wsPort, {
              command: "ledger", ledger_index: "validated", transactions: true, expand: false,
            });
            const txCount = Array.isArray(ledgerResp.result?.ledger?.transactions)
              ? ledgerResp.result.ledger.transactions.length : 0;
            tps = Math.round((txCount / Math.max(elapsedSec, 1)) * 100) / 100;
          } catch {}
        }
      }
      lastLedgerIndex = currentLedger;
      lastLedgerTime = now;

      // Gather host system CPU and memory usage
      let cpuLoad = 0;
      let memPercent = 0;
      try {
        const [cpu, mem] = await Promise.all([si.currentLoad(), si.mem()]);
        cpuLoad = Math.round(cpu.currentLoad * 100) / 100;
        memPercent = Math.round((mem.used / mem.total) * 10000) / 100;
      } catch {}

      // Persist the snapshot
      await storage.addMetricsSnapshot({
        nodeHost: config.host,
        cpuLoad,
        memoryPercent: memPercent,
        peerCount: nodeData.peerCount ?? null,
        ledgerIndex: nodeData.ledgerIndex ?? null,
        closeTimeMs: nodeData.closeTimeMs ?? null,
        loadFactor: nodeData.loadFactor ?? null,
        serverState: nodeData.serverState ?? null,
        nodeLatencyMs: nodeData.nodeLatencyMs ?? null,
        reserveBase: nodeData.reserveBase ?? null,
        reserveInc: nodeData.reserveInc ?? null,
        baseFee: nodeData.baseFee ?? null,
        tps,
      });

      // Prune snapshots older than 7 days
      await storage.cleanOldMetrics(7);

      // Run the alert detection engine against the latest values
      await checkAlerts(cpuLoad, memPercent, nodeData);
    } catch (err: any) {
      log(`Metrics snapshot error: ${err.message}`, "metrics");
    }
  }

  // === Alert Detection Engine ===
  // Compares current metric values against user-configured thresholds.
  // Creates an alert (and fires webhooks) if a threshold is breached and
  // no alert of the same type exists within the last 5 minutes (deduplication).
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

        // Direction determines comparison: "above" means alert when value >= threshold,
        // "below" means alert when value <= threshold (e.g. peer count dropping too low).
        const isAbove = t.direction === "above";
        const isCritical = isAbove ? currentValue >= t.criticalValue : currentValue <= t.criticalValue;
        const isWarning = isAbove ? currentValue >= t.warningValue : currentValue <= t.warningValue;

        if (isCritical || isWarning) {
          const severity = isCritical ? "critical" : "warning";
          // Suppress duplicate alerts: skip if same type was fired in the last 5 minutes
          const recent = await storage.getRecentAlertByType(t.metric, 5);
          if (!recent) {
            const direction = isAbove ? "exceeded" : "dropped below";
            const threshold = isCritical ? t.criticalValue : t.warningValue;
            const alertMsg = `${label} ${direction} ${severity} threshold: ${currentValue.toFixed(1)} (threshold: ${threshold})`;
            await storage.createAlert({
              type: t.metric,
              severity,
              message: alertMsg,
              value: currentValue,
              threshold,
            });
            // Fire webhooks asynchronously — don't block the collector
            fireWebhooks(`alert_${severity}`, alertMsg, severity).catch(() => {});
          }
        }
      }
    } catch (err: any) {
      log(`Alert check error: ${err.message}`, "alerts");
    }
  }

  // Seed default thresholds on startup, then start the periodic collector
  await storage.seedDefaultThresholds();
  setInterval(collectMetricsSnapshot, 30000);
  collectMetricsSnapshot();

  // === Metrics History API ===
  // Returns stored snapshots for the last N hours (default 24)
  app.get("/api/metrics/history", async (req: Request, res: Response) => {
    const hours = parseInt(req.query.hours as string) || 24;
    const data = await storage.getMetricsHistory(hours);
    res.json(data);
  });

  // === Alert API Endpoints ===

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

  // === Transaction Search + Account Lookup ===

  // Look up a single transaction by hash
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

  // Look up account info by address
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

  // Fetch recent transactions for an account (last 20)
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

  // === Fee Estimator ===
  // Returns current transaction fee levels (minimum, median, open ledger fee)

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

  // === Validator + Amendment Endpoints ===
  // These require the admin port since "validators" and "feature" are admin-only commands.

  // List trusted validators
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

  // List protocol amendments (features) — enabled, supported, and vetoed status
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

  // Get this node's own validator info (only meaningful if the node is a validator)
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

  // === Multi-Node Management ===
  // CRUD for saved XRPL node configurations + activate/status endpoints

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

  // Sets a node as active — all subsequent XRPL queries will target this node
  app.post("/api/nodes/:id/activate", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const node = await storage.setActiveNode(id);
    if (!node) return res.status(404).json({ message: "Node not found" });
    res.json(node);
  });

  // Quick health check for a specific saved node (without activating it)
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

  // === LM Studio AI Integration ===
  // Proxies chat requests to a local LM Studio instance with XRPL-aware context injection.

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

  // Tests connectivity to the configured LM Studio instance
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

  // Main AI analysis endpoint — streams responses via Server-Sent Events (SSE).
  // Gathers live XRPL context data based on the "context" parameter
  // (node, ledger, peers, system, alerts, or general for all), then sends
  // the conversation history + context to LM Studio for completion.
  app.post("/api/ai/analyze", async (req: Request, res: Response) => {
    const { message, sessionId, context } = req.body;
    if (!message) return res.status(400).json({ message: "Message is required" });

    const config = await storage.getAiConfig();
    const host = config?.host || "localhost";
    const port = config?.port || 1234;
    const model = config?.model || "";
    const sid = sessionId || `session-${Date.now()}`;

    // Build real-time context string from live XRPL data based on the requested context type
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

    // Persist the user message
    await storage.addAiMessage({ sessionId: sid, role: "user", content: message, context: context || null });

    // Build the system prompt with injected real-time context
    const systemPrompt = `You are an XRPL Node Monitoring AI Assistant. You help analyze XRP Ledger node health, network performance, and provide insights about the node's operation. Be concise but thorough. Use technical XRPL terminology when appropriate.${contextData ? `\n\nCurrent Node Data:${contextData}` : ""}`;

    // Include last 20 messages for conversation continuity
    const previousMessages = await storage.getAiConversations(sid);
    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...previousMessages.slice(-20).map(m => ({ role: m.role, content: m.content })),
    ];

    // Set up SSE headers for streaming the AI response
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

      // Stream response chunks from LM Studio to the client via SSE
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
        // Fallback for non-streaming responses (shouldn't normally happen)
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

  // === Export & Reporting ===
  // Generates a summary report of metrics history with optional CSV export.
  // Calculates min/avg/max for CPU, memory, and peer count over the requested time range.
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

    // CSV format: returns a downloadable file with headers
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

  // === Health Score ===
  // Computes a 0-100 composite health score from multiple weighted factors:
  // server state (25pts), peer count (20pts), ledger freshness (20pts),
  // latency (15pts), load factor (10pts), uptime (10pts).
  app.get("/api/node/health-score", async (_req: Request, res: Response) => {
    try {
      const config = await storage.getConnectionConfig();
      let score = 0;
      const components: Record<string, { score: number; max: number; detail: string }> = {};

      try {
        const startTime = Date.now();
        const response = await sendXrplCommand(config.host, config.wsPort, { command: "server_info" });
        const latency = Date.now() - startTime;

        if (response.result?.info) {
          const info = response.result.info;

          // Server state scoring: "full"/"proposing"/"validating" = max, degraded states get less
          const state = info.server_state || "disconnected";
          const stateScore = state === "full" || state === "proposing" || state === "validating" ? 25
            : state === "tracking" || state === "syncing" ? 15
            : state === "connected" ? 5 : 0;
          components.serverState = { score: stateScore, max: 25, detail: state };
          score += stateScore;

          // Peer count: linearly scales up to 20 peers for full score
          const peers = info.peers || 0;
          const peerScore = Math.min(peers / 20 * 20, 20);
          components.peers = { score: Math.round(peerScore), max: 20, detail: `${peers} peers` };
          score += peerScore;

          // Ledger age: fresher ledgers score higher (<=10s = perfect)
          const ledgerAge = info.validated_ledger?.age || 999;
          const ageScore = ledgerAge <= 10 ? 20 : ledgerAge <= 30 ? 15 : ledgerAge <= 60 ? 8 : 0;
          components.ledgerAge = { score: ageScore, max: 20, detail: `${ledgerAge}s ago` };
          score += ageScore;

          // Latency: lower WebSocket round-trip = higher score
          const latencyScore = latency <= 100 ? 15 : latency <= 500 ? 10 : latency <= 2000 ? 5 : 0;
          components.latency = { score: latencyScore, max: 15, detail: `${latency}ms` };
          score += latencyScore;

          // Load factor: 1x = no load (perfect), higher values reduce score
          const lf = info.load_factor || 1;
          const loadScore = lf <= 1 ? 10 : lf <= 2 ? 7 : lf <= 5 ? 3 : 0;
          components.loadFactor = { score: loadScore, max: 10, detail: `${lf}x` };
          score += loadScore;

          // Uptime: longer uptime = higher score (1 day+ = max)
          const uptime = info.uptime || 0;
          const uptimeScore = uptime >= 86400 ? 10 : uptime >= 3600 ? 7 : uptime >= 300 ? 3 : 1;
          components.uptime = { score: uptimeScore, max: 10, detail: `${Math.floor(uptime / 3600)}h` };
          score += uptimeScore;
        }
      } catch {
        components.connection = { score: 0, max: 100, detail: "Cannot connect" };
      }

      res.json({ score: Math.round(score), components });
    } catch (err: any) {
      res.json({ score: 0, components: {}, error: err.message });
    }
  });

  // === Ledger Lag ===
  // Compares local node's latest validated ledger against the public s2.ripple.com node.
  // A lag of <=3 ledgers is considered synced. Both requests run in parallel.
  app.get("/api/node/ledger-lag", async (_req: Request, res: Response) => {
    try {
      const config = await storage.getConnectionConfig();
      const [localResp, publicResp] = await Promise.allSettled([
        sendXrplCommand(config.host, config.wsPort, { command: "server_info" }),
        sendXrplCommandToPort("s2.ripple.com", 51233, { command: "server_info" }),
      ]);

      const localSeq = localResp.status === "fulfilled" ? localResp.value.result?.info?.validated_ledger?.seq || 0 : 0;
      const publicSeq = publicResp.status === "fulfilled" ? publicResp.value.result?.info?.validated_ledger?.seq || 0 : 0;
      const lag = publicSeq > 0 && localSeq > 0 ? publicSeq - localSeq : null;

      res.json({ localLedger: localSeq, publicLedger: publicSeq, lag, synced: lag !== null && Math.abs(lag) <= 3 });
    } catch (err: any) {
      res.json({ localLedger: 0, publicLedger: 0, lag: null, synced: false, error: err.message });
    }
  });

  // === TPS (Transactions Per Second) ===
  // Returns current, average, and peak TPS from the last hour of stored snapshots
  app.get("/api/node/tps", async (_req: Request, res: Response) => {
    const snapshots = await storage.getMetricsHistory(1);
    const tpsValues = snapshots.filter(s => s.tps != null && s.tps! > 0).map(s => s.tps!);
    const current = tpsValues.length > 0 ? tpsValues[tpsValues.length - 1] : 0;
    const avg = tpsValues.length > 0 ? tpsValues.reduce((a, b) => a + b, 0) / tpsValues.length : 0;
    const peak = tpsValues.length > 0 ? Math.max(...tpsValues) : 0;
    res.json({ current: Math.round(current * 100) / 100, avg: Math.round(avg * 100) / 100, peak: Math.round(peak * 100) / 100 });
  });

  // === UNL Comparison ===
  // Compares this node's trusted validator list against Ripple's recommended UNL
  // (fetched from vl.ripple.com). Shows overlap, local-only, and UNL-only validators.
  app.get("/api/node/unl-comparison", async (_req: Request, res: Response) => {
    try {
      const config = await storage.getConnectionConfig();
      let localValidators: string[] = [];
      try {
        const vResp = await sendXrplCommand(config.host, config.adminPort, { command: "validators" });
        if (vResp.result) {
          const vList = vResp.result.trusted_validators || vResp.result.validators || [];
          localValidators = vList.map((v: any) => v.validation_public_key || v.pubkey_validator || "").filter(Boolean);
        }
      } catch {}

      let recommendedUNL: string[] = [];
      try {
        const unlResp = await fetch("https://vl.ripple.com", { signal: AbortSignal.timeout(5000) });
        if (unlResp.ok) {
          const unlData = await unlResp.json();
          if (unlData.validators) {
            recommendedUNL = unlData.validators.map((v: any) => v.validation_public_key || "").filter(Boolean);
          }
        }
      } catch {}

      const localSet = new Set(localValidators);
      const unlSet = new Set(recommendedUNL);
      const inBoth = localValidators.filter(v => unlSet.has(v));
      const localOnly = localValidators.filter(v => !unlSet.has(v));
      const unlOnly = recommendedUNL.filter(v => !localSet.has(v));

      res.json({
        localCount: localValidators.length,
        unlCount: recommendedUNL.length,
        matching: inBoth.length,
        localOnly: localOnly.length,
        unlOnly: unlOnly.length,
        overlap: localValidators.length > 0 ? Math.round((inBoth.length / localValidators.length) * 100) : 0,
        details: { inBoth: inBoth.slice(0, 10), localOnly: localOnly.slice(0, 10), unlOnly: unlOnly.slice(0, 10) },
      });
    } catch (err: any) {
      res.json({ error: err.message });
    }
  });

  // === Peer Geolocation ===
  // Extracts public IPs from connected peers (filtering out private/local ranges),
  // then geolocates up to 50 unique IPs via the ip-api.com free API.
  // Rate-limited with 200ms delay between requests to respect the API's limits.
  app.get("/api/node/peer-locations", async (_req: Request, res: Response) => {
    try {
      const config = await storage.getConnectionConfig();
      const response = await sendXrplCommand(config.host, config.adminPort, { command: "peers" });
      if (!response.result?.peers) return res.json({ locations: [] });

      // Extract public IPs, filtering out private/loopback ranges
      const ips = response.result.peers
        .map((p: any) => {
          const addr = p.address || "";
          const ip = addr.split(":")[0];
          return ip && !ip.startsWith("10.") && !ip.startsWith("192.168.") && !ip.startsWith("172.") && ip !== "127.0.0.1" ? ip : null;
        })
        .filter(Boolean);

      const uniqueIps = [...new Set(ips)] as string[];
      const locations: { ip: string; lat: number; lon: number; country: string; city: string; count: number }[] = [];

      for (const ip of uniqueIps.slice(0, 50)) {
        try {
          const geoResp = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,city,lat,lon`, { signal: AbortSignal.timeout(3000) });
          if (geoResp.ok) {
            const geo = await geoResp.json();
            if (geo.status === "success") {
              const count = ips.filter((i: string) => i === ip).length;
              locations.push({ ip, lat: geo.lat, lon: geo.lon, country: geo.country, city: geo.city, count });
            }
          }
          // Rate limit: ip-api.com allows ~45 requests/minute on the free tier
          await new Promise(r => setTimeout(r, 200));
        } catch {}
      }

      res.json({ locations, totalPeers: response.result.peers.length, geolocated: locations.length });
    } catch (err: any) {
      res.json({ locations: [], error: err.message });
    }
  });

  // === Webhook CRUD ===
  // Manages notification webhook endpoints (Discord, Telegram, generic JSON)

  app.get("/api/webhooks", async (_req: Request, res: Response) => {
    const configs = await storage.getWebhookConfigs();
    res.json(configs);
  });

  app.post("/api/webhooks", async (req: Request, res: Response) => {
    const { name, type, url, events } = req.body;
    if (!name || !url) return res.status(400).json({ message: "Name and URL are required" });
    const config = await storage.createWebhookConfig({
      name,
      type: type || "discord",
      url,
      enabled: true,
      events: events || ["alert_critical", "alert_warning"],
    });
    res.json(config);
  });

  app.put("/api/webhooks/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const result = await storage.updateWebhookConfig(id, req.body);
    if (!result) return res.status(404).json({ message: "Webhook not found" });
    res.json(result);
  });

  app.delete("/api/webhooks/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const deleted = await storage.deleteWebhookConfig(id);
    if (!deleted) return res.status(404).json({ message: "Webhook not found" });
    res.json({ success: true });
  });

  // Sends a test notification to verify webhook connectivity
  app.post("/api/webhooks/:id/test", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const wh = await storage.getWebhookConfig(id);
    if (!wh) return res.status(404).json({ message: "Webhook not found" });
    try {
      if (wh.type === "discord") {
        await fetch(wh.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            embeds: [{ title: "XRPL Node Monitor — Test", description: "This is a test notification from your XRPL Node Monitor.", color: 0x00E6FF, timestamp: new Date().toISOString() }],
          }),
        });
      } else {
        await fetch(wh.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event: "test", message: "Test notification from XRPL Node Monitor", timestamp: new Date().toISOString() }),
        });
      }
      res.json({ success: true });
    } catch (err: any) {
      res.json({ success: false, error: err.message });
    }
  });

  // === Multi-Node Comparison ===
  // Queries all saved nodes in parallel and returns a side-by-side comparison
  // of their state, peer count, ledger sequence, latency, and version.
  app.get("/api/nodes/compare", async (_req: Request, res: Response) => {
    const nodes = await storage.getSavedNodes();
    const results = await Promise.allSettled(
      nodes.map(async (node) => {
        try {
          const startTime = Date.now();
          const response = await sendXrplCommandToPort(node.host, node.wsPort, { command: "server_info" });
          const latency = Date.now() - startTime;
          if (response.result?.info) {
            const info = response.result.info;
            return {
              id: node.id,
              name: node.name,
              host: node.host,
              status: "connected",
              latency,
              serverState: info.server_state,
              peers: info.peers,
              ledgerSeq: info.validated_ledger?.seq,
              ledgerAge: info.validated_ledger?.age,
              uptime: info.uptime,
              buildVersion: info.build_version,
              loadFactor: info.load_factor,
            };
          }
          return { id: node.id, name: node.name, host: node.host, status: "error" };
        } catch {
          return { id: node.id, name: node.name, host: node.host, status: "disconnected" };
        }
      })
    );
    res.json(results.map(r => r.status === "fulfilled" ? r.value : { status: "error" }));
  });

  return httpServer;
}
