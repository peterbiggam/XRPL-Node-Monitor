import { useQuery } from "@tanstack/react-query";
import { MetricCard } from "@/components/metric-card";
import { StatusIndicator } from "@/components/status-indicator";
import { SparklineChart } from "@/components/sparkline-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Server,
  BookOpen,
  Globe,
  Zap,
  WifiOff,
} from "lucide-react";
import { useState, useRef, useCallback } from "react";
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

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-10 w-full mt-3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DisconnectedState({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4" data-testid="state-disconnected">
      <div className="flex items-center justify-center w-16 h-16 rounded-md bg-muted/50">
        <WifiOff className="w-8 h-8 text-muted-foreground" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-lg font-medium">Node Unavailable</p>
        <p className="text-sm text-muted-foreground max-w-md">
          {message || "Unable to connect to the XRPL node. Check your connection settings and ensure the node is running."}
        </p>
      </div>
      <StatusIndicator status="disconnected" label="Disconnected" />
    </div>
  );
}

export default function DashboardPage() {
  const closeTimesRef = useRef<number[]>([]);
  const ledgerSeqsRef = useRef<number[]>([]);
  const [closeTimes, setCloseTimes] = useState<number[]>([]);
  const [ledgerSeqs, setLedgerSeqs] = useState<number[]>([]);

  const trackLedgerData = useCallback((ledgerData: LedgerInfo | null) => {
    if (!ledgerData) return;
    const seq = ledgerData.ledgerIndex;
    const seqs = ledgerSeqsRef.current;
    if (seqs.length === 0 || seqs[seqs.length - 1] !== seq) {
      const newSeqs = [...seqs, seq].slice(-20);
      ledgerSeqsRef.current = newSeqs;
      setLedgerSeqs(newSeqs);

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
          <h1 className="text-xl font-semibold" data-testid="text-page-title">Dashboard</h1>
          <p className="text-sm text-muted-foreground">XRPL Node Overview</p>
        </div>
        <DashboardSkeleton />
      </div>
    );
  }

  if (isDisconnected && !node) {
    return (
      <div className="p-4 overflow-y-auto h-full">
        <div className="mb-6">
          <h1 className="text-xl font-semibold" data-testid="text-page-title">Dashboard</h1>
          <p className="text-sm text-muted-foreground">XRPL Node Overview</p>
        </div>
        <DisconnectedState message={nodeResp?.message} />
      </div>
    );
  }

  const serverState = node?.serverState ?? "unknown";
  const statusType = getServerStateStatus(serverState);

  return (
    <div className="p-4 overflow-y-auto h-full">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-page-title">Dashboard</h1>
          <p className="text-sm text-muted-foreground">XRPL Node Overview</p>
        </div>
        <StatusIndicator status={statusType} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          icon={Server}
          label="Node Status"
          value={serverState.charAt(0).toUpperCase() + serverState.slice(1)}
          subValue={node ? `Uptime: ${formatUptime(node.uptime)}` : undefined}
          testId="card-node-status"
        >
          <div className="space-y-1">
            {node?.buildVersion && (
              <p className="text-xs text-muted-foreground" data-testid="text-build-version">
                v{node.buildVersion}
              </p>
            )}
            <StatusIndicator status={statusType} label={statusType.charAt(0).toUpperCase() + statusType.slice(1)} />
          </div>
        </MetricCard>

        <MetricCard
          icon={BookOpen}
          label="Latest Ledger"
          value={ledger ? formatNumber(ledger.ledgerIndex) : "--"}
          subValue={ledger?.closeTimeHuman ? ledger.closeTimeHuman : undefined}
          testId="card-ledger"
        >
          {ledger && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground" data-testid="text-tx-count">
                {formatNumber(ledger.transactionCount)} transactions
              </p>
              {ledgerSeqs.length > 1 && (
                <SparklineChart data={ledgerSeqs} color="hsl(var(--chart-1))" />
              )}
            </div>
          )}
        </MetricCard>

        <MetricCard
          icon={Globe}
          label="Network"
          value={node ? formatNumber(node.peers) : "--"}
          subValue={node ? getNetworkType(node.completeLedgers) : undefined}
          testId="card-network"
        >
          {node && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground" data-testid="text-quorum">
                Quorum: {node.validationQuorum}
              </p>
              <p className="text-xs text-muted-foreground" data-testid="text-peers-label">
                Connected Peers
              </p>
            </div>
          )}
        </MetricCard>

        <MetricCard
          icon={Zap}
          label="Performance"
          value={
            node
              ? `${node.lastClose.convergeTimeS.toFixed(1)}s`
              : "--"
          }
          subValue={node ? `${node.lastClose.proposers} proposers` : undefined}
          testId="card-performance"
        >
          {node && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground" data-testid="text-load-factor">
                Load Factor: {node.loadFactor}
              </p>
              {closeTimes.length > 1 && (
                <SparklineChart data={closeTimes} color="hsl(var(--chart-2))" />
              )}
            </div>
          )}
        </MetricCard>
      </div>

      {node && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Card data-testid="card-ledger-range">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground mb-2">Complete Ledger Range</p>
              <p className="text-lg font-mono" data-testid="text-ledger-range">
                {node.completeLedgers || "N/A"}
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-node-key">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground mb-2">Node Public Key</p>
              <p className="text-sm font-mono truncate" data-testid="text-pubkey">
                {node.pubkeyNode || "N/A"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
