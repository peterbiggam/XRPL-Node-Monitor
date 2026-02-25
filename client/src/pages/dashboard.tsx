import { useQuery } from "@tanstack/react-query";
import { MetricCard } from "@/components/metric-card";
import { StatusIndicator } from "@/components/status-indicator";
import { SparklineChart } from "@/components/sparkline-chart";
import { Card, CardContent } from "@/components/ui/card";
import {
  Server,
  BookOpen,
  Globe,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { NodeInfo, LedgerInfo } from "@shared/schema";

interface NodeResponse {
  status: string;
  data: NodeInfo | null;
  message?: string;
}

interface LedgerResponse {
  status: string;
  data: LedgerInfo | null;
  message?: string;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function getServerStateStatus(state: string): "synced" | "syncing" | "disconnected" {
  if (state === "full" || state === "proposing" || state === "validating") return "synced";
  if (state === "connected" || state === "syncing" || state === "tracking") return "syncing";
  return "disconnected";
}

function getNetworkType(completeLedgers: string): string {
  if (!completeLedgers) return "Unknown";
  const firstLedger = parseInt(completeLedgers.split("-")[0]);
  if (firstLedger === 32570) return "Mainnet";
  if (firstLedger <= 1000) return "Testnet / Devnet";
  return "Network";
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="cyber-border animate-pulse">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-9 w-9 bg-primary/10 rounded" style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }} />
            </div>
            <div className="space-y-2">
              <div className="h-8 w-32 bg-muted rounded cyber-glow" />
              <div className="h-3 w-20 bg-muted rounded" />
            </div>
            <div className="h-10 w-full mt-3 bg-muted rounded" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DisconnectedBanner({ message }: { message?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-lg cyber-border overflow-hidden"
      style={{ boxShadow: "0 0 20px rgba(239, 68, 68, 0.15), 0 0 40px rgba(239, 68, 68, 0.05)" }}
      data-testid="state-disconnected"
    >
      <div className="h-[2px] bg-gradient-to-r from-transparent via-destructive to-transparent animate-flicker" />
      <div className="flex items-center gap-4 px-4 py-3 bg-destructive/5">
        <div className="relative flex-shrink-0">
          <svg viewBox="0 0 60 52" className="w-10 h-10 text-destructive/40">
            <polygon
              points="30,1 59,16 59,36 30,51 1,36 1,16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-destructive animate-flicker" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-mono font-bold uppercase tracking-widest animate-flicker"
            style={{ textShadow: "0 0 10px rgba(239,68,68,0.5), 0 0 20px rgba(239,68,68,0.2)" }}
            data-testid="text-signal-lost"
          >
            SIGNAL LOST
          </p>
          <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
            {message || "Unable to connect to XRPL node. Check connection settings."}
          </p>
        </div>
        <StatusIndicator status="disconnected" label="Offline" />
      </div>
    </motion.div>
  );
}

function DataStreamSection({ hashes }: { hashes: string[] }) {
  if (hashes.length === 0) return null;

  return (
    <motion.div variants={itemVariants} data-testid="section-data-stream">
      <Card className="cyber-border overflow-visible">
        <CardContent className="p-4">
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
            DATA STREAM
          </p>
          <div className="space-y-1">
            {hashes.map((hash, i) => (
              <div
                key={`${hash}-${i}`}
                className="flex items-center gap-2 font-mono text-xs"
                style={{ opacity: 1 - i * 0.15 }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-glow flex-shrink-0" />
                <span className="text-primary/80 truncate" data-testid={`text-hash-${i}`}>
                  {hash}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function DashboardPage() {
  const closeTimesRef = useRef<number[]>([]);
  const ledgerSeqsRef = useRef<number[]>([]);
  const ledgerHashesRef = useRef<string[]>([]);
  const [closeTimes, setCloseTimes] = useState<number[]>([]);
  const [ledgerSeqs, setLedgerSeqs] = useState<number[]>([]);
  const [ledgerHashes, setLedgerHashes] = useState<string[]>([]);

  const trackLedgerData = useCallback((ledgerData: LedgerInfo | null) => {
    if (!ledgerData) return;
    const seq = ledgerData.ledgerIndex;
    const seqs = ledgerSeqsRef.current;
    if (seqs.length === 0 || seqs[seqs.length - 1] !== seq) {
      const newSeqs = [...seqs, seq].slice(-20);
      ledgerSeqsRef.current = newSeqs;
      setLedgerSeqs(newSeqs);

      if (ledgerData.ledgerHash) {
        const newHashes = [ledgerData.ledgerHash, ...ledgerHashesRef.current].slice(0, 6);
        ledgerHashesRef.current = newHashes;
        setLedgerHashes(newHashes);
      }

      if (ledgerData.closeTime > 0) {
        const newTimes = [...closeTimesRef.current, ledgerData.closeTime % 100].slice(-20);
        closeTimesRef.current = newTimes;
        setCloseTimes(newTimes);
      }
    }
  }, []);

  const { data: nodeResp, isLoading: nodeLoading } = useQuery<NodeResponse>({
    queryKey: ["/api/node/info"],
    refetchInterval: 5000,
  });

  const { data: ledgerResp, isLoading: ledgerLoading } = useQuery<LedgerResponse>({
    queryKey: ["/api/node/ledger"],
    refetchInterval: 5000,
  });

  if (ledgerResp?.data) {
    trackLedgerData(ledgerResp.data);
  }

  const isLoading = nodeLoading || ledgerLoading;
  const isDisconnected = nodeResp?.status === "disconnected" || (!nodeLoading && !nodeResp?.data);
  const node = nodeResp?.data ?? null;
  const ledger = ledgerResp?.data ?? null;

  if (isLoading) {
    return (
      <div className="p-4 overflow-y-auto h-full">
        <div className="mb-6">
          <h1 className="text-xl font-semibold font-mono uppercase tracking-widest text-glow" data-testid="text-page-title">
            XRPL NODE COMMAND CENTER
          </h1>
          <div className="neon-line mt-2" />
        </div>
        <DashboardSkeleton />
      </div>
    );
  }

  const serverState = node?.serverState ?? "unknown";
  const statusType = isDisconnected ? "disconnected" : getServerStateStatus(serverState);

  return (
    <div className="p-4 overflow-y-auto h-full">
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="relative scanline">
            <h1
              className="text-xl font-bold font-mono uppercase tracking-widest text-glow"
              data-testid="text-page-title"
            >
              XRPL NODE COMMAND CENTER
            </h1>
          </div>
          {!isDisconnected && <StatusIndicator status={statusType} />}
        </div>
        <div className="neon-line mt-2" />
        <div className="mt-2 h-[2px] overflow-hidden rounded-full bg-muted/30">
          <div
            className={`h-full w-1/3 bg-gradient-to-r from-transparent to-transparent ${
              isDisconnected ? "via-destructive/50" : "via-primary"
            } animate-data-flow`}
          />
        </div>
      </div>

      <AnimatePresence>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-4"
        >
          {isDisconnected && (
            <DisconnectedBanner message={nodeResp?.message} />
          )}

          <motion.div
            variants={containerVariants}
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4"
          >
            <motion.div variants={itemVariants}>
              <MetricCard
                icon={Server}
                label="Node Status"
                value={isDisconnected ? "Offline" : serverState.charAt(0).toUpperCase() + serverState.slice(1)}
                subValue={node ? `Uptime: ${formatUptime(node.uptime)}` : "No connection"}
                testId="card-node-status"
              >
                <div className="space-y-1">
                  {node?.buildVersion && (
                    <p className="text-xs text-muted-foreground font-mono" data-testid="text-build-version">
                      v{node.buildVersion}
                    </p>
                  )}
                  <StatusIndicator
                    status={isDisconnected ? "disconnected" : statusType}
                    label={isDisconnected ? "Disconnected" : statusType.charAt(0).toUpperCase() + statusType.slice(1)}
                  />
                </div>
              </MetricCard>
            </motion.div>

            <motion.div variants={itemVariants}>
              <MetricCard
                icon={BookOpen}
                label="Latest Ledger"
                value={ledger ? formatNumber(ledger.ledgerIndex) : "--"}
                subValue={ledger?.closeTimeHuman ? ledger.closeTimeHuman : "Awaiting data"}
                testId="card-ledger"
              >
                {ledger ? (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-mono" data-testid="text-tx-count">
                      {formatNumber(ledger.transactionCount)} transactions
                    </p>
                    {ledgerSeqs.length > 1 && (
                      <SparklineChart data={ledgerSeqs} color="hsl(var(--chart-1))" />
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground font-mono">No ledger data</p>
                )}
              </MetricCard>
            </motion.div>

            <motion.div variants={itemVariants}>
              <MetricCard
                icon={Globe}
                label="Network"
                value={node ? formatNumber(node.peers) : "--"}
                subValue={node ? getNetworkType(node.completeLedgers) : "Awaiting data"}
                testId="card-network"
              >
                {node ? (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-mono" data-testid="text-quorum">
                      Quorum: {node.validationQuorum}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono" data-testid="text-peers-label">
                      Connected Peers
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground font-mono">No peer data</p>
                )}
              </MetricCard>
            </motion.div>

            <motion.div variants={itemVariants}>
              <MetricCard
                icon={Zap}
                label="Performance"
                value={
                  node
                    ? `${node.lastClose.convergeTimeS.toFixed(1)}s`
                    : "--"
                }
                subValue={node ? `${node.lastClose.proposers} proposers` : "Awaiting data"}
                testId="card-performance"
              >
                {node ? (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-mono" data-testid="text-load-factor">
                      Load Factor: {node.loadFactor}
                    </p>
                    {closeTimes.length > 1 && (
                      <SparklineChart data={closeTimes} color="hsl(var(--chart-2))" />
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground font-mono">No performance data</p>
                )}
              </MetricCard>
            </motion.div>
          </motion.div>

          <motion.div
            variants={containerVariants}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <motion.div variants={itemVariants}>
              <Card className="cyber-border overflow-visible" data-testid="card-ledger-range">
                <CardContent className="p-4">
                  <p className="text-xs font-mono text-muted-foreground mb-2 uppercase tracking-wider">Complete Ledger Range</p>
                  <p className="text-lg font-mono text-primary text-glow" data-testid="text-ledger-range">
                    {node?.completeLedgers || "--"}
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="cyber-border overflow-visible" data-testid="card-node-key">
                <CardContent className="p-4">
                  <p className="text-xs font-mono text-muted-foreground mb-2 uppercase tracking-wider">Node Public Key</p>
                  <p className="text-sm font-mono truncate text-primary/80" data-testid="text-pubkey">
                    {node?.pubkeyNode || "--"}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          <DataStreamSection hashes={ledgerHashes} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
