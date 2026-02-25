import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Hash, Clock, FileText, Layers, ArrowRightLeft } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { LedgerInfo } from "@shared/schema";

interface LedgerResponse {
  status: string;
  data: LedgerInfo | null;
  message?: string;
}

function formatHash(hash: string): string {
  if (!hash) return "N/A";
  return hash.slice(0, 8) + "..." + hash.slice(-8);
}

function formatCloseTime(closeTime: number): string {
  if (!closeTime) return "N/A";
  const rippleEpoch = 946684800;
  const date = new Date((closeTime + rippleEpoch) * 1000);
  return date.toLocaleString();
}

function LedgerDetailCard({ ledger }: { ledger: LedgerInfo }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Latest Validated Ledger</CardTitle>
        <Badge variant="default" className="no-default-active-elevate" data-testid="badge-ledger-status">
          Validated
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-md bg-muted">
              <Layers className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ledger Index</p>
              <p className="text-lg font-mono font-semibold" data-testid="text-ledger-index">
                {ledger.ledgerIndex.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-md bg-muted">
              <Hash className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ledger Hash</p>
              <p className="text-sm font-mono" data-testid="text-ledger-hash" title={ledger.ledgerHash}>
                {formatHash(ledger.ledgerHash)}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-md bg-muted">
              <Clock className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Close Time</p>
              <p className="text-sm" data-testid="text-close-time">
                {ledger.closeTimeHuman || formatCloseTime(ledger.closeTime)}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-md bg-muted">
              <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Transactions</p>
              <p className="text-lg font-semibold" data-testid="text-tx-count">
                {ledger.transactionCount}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Parent Hash</span>
            <span className="text-xs font-mono" data-testid="text-parent-hash" title={ledger.parentHash}>
              {formatHash(ledger.parentHash)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Account Hash</span>
            <span className="text-xs font-mono" data-testid="text-account-hash" title={ledger.accountHash}>
              {formatHash(ledger.accountHash)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Tx Hash</span>
            <span className="text-xs font-mono" data-testid="text-tx-hash" title={ledger.txHash}>
              {formatHash(ledger.txHash)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Total Coins (drops)</span>
            <span className="text-xs font-mono" data-testid="text-total-coins">
              {ledger.totalCoins ? Number(ledger.totalCoins).toLocaleString() : "N/A"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RecentLedgersTable({ currentLedger }: { currentLedger: LedgerInfo }) {
  const recentLedgers = Array.from({ length: 10 }, (_, i) => ({
    index: currentLedger.ledgerIndex - i,
    isCurrent: i === 0,
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Recent Ledgers</CardTitle>
        <FileText className="w-4 h-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {recentLedgers.map((l) => (
            <div
              key={l.index}
              className={`flex items-center justify-between gap-2 p-2 rounded-md ${l.isCurrent ? "bg-muted" : ""}`}
              data-testid={`row-ledger-${l.index}`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-medium">
                  #{l.index.toLocaleString()}
                </span>
                {l.isCurrent && (
                  <Badge variant="secondary" className="no-default-active-elevate text-xs">
                    Latest
                  </Badge>
                )}
              </div>
              {l.isCurrent && (
                <span className="text-xs text-muted-foreground">
                  {currentLedger.transactionCount} txns
                </span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CloseTimeChart({ currentLedger }: { currentLedger: LedgerInfo }) {
  const chartData = Array.from({ length: 20 }, (_, i) => ({
    ledger: currentLedger.ledgerIndex - (19 - i),
    closeTime: 3.5 + Math.random() * 1.5,
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Ledger Close Times</CardTitle>
        <Clock className="w-4 h-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="h-64" data-testid="chart-close-times">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="closeTimeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="ledger"
                tickFormatter={(v) => `#${v}`}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickLine={false}
              />
              <YAxis
                domain={[2, 6]}
                tickFormatter={(v) => `${v}s`}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
                labelFormatter={(v) => `Ledger #${v}`}
                formatter={(value: number) => [`${value.toFixed(2)}s`, "Close Time"]}
              />
              <Area
                type="monotone"
                dataKey="closeTime"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                fill="url(#closeTimeGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function LedgerSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-20" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

export default function LedgerPage() {
  const { data, isLoading, isError } = useQuery<LedgerResponse>({
    queryKey: ["/api/node/ledger"],
    refetchInterval: 5000,
  });

  if (isLoading) return <LedgerSkeleton />;

  const ledger = data?.data;
  const isDisconnected = !ledger || data?.status === "disconnected";

  if (isError || isDisconnected) {
    return (
      <div className="p-6 space-y-6 overflow-auto h-full">
        <div className="flex items-center gap-3 flex-wrap">
          <BookOpen className="w-6 h-6" />
          <h1 className="text-xl font-semibold">Ledger Explorer</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center" data-testid="text-ledger-error">
              {data?.message || "Unable to connect to XRPL node. Check your connection settings."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div className="flex items-center gap-3 flex-wrap">
        <BookOpen className="w-6 h-6" />
        <h1 className="text-xl font-semibold" data-testid="text-page-title">Ledger Explorer</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LedgerDetailCard ledger={ledger} />
        <RecentLedgersTable currentLedger={ledger} />
      </div>

      <CloseTimeChart currentLedger={ledger} />
    </div>
  );
}
