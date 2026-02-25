import type { Express } from "express";
import type { Server } from "http";
import WebSocket from "ws";
import si from "systeminformation";
import { storage } from "./storage";
import { connectionConfigSchema } from "@shared/schema";
import type { NodeInfo, LedgerInfo, PeerInfo, TransactionInfo, SystemMetrics } from "@shared/schema";
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

  return httpServer;
}
