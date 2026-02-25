import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Hash, Clock, FileText, Layers, ArrowRightLeft } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import type { LedgerInfo, MetricsSnapshot } from "@shared/schema";

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

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

function LedgerDetailCard({ ledger }: { ledger: LedgerInfo }) {
  return (
    <motion.div variants={itemVariants}>
      <Card className="cyber-border relative overflow-visible">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium tracking-wide uppercase">Latest Validated Ledger</CardTitle>
          <Badge variant="default" className="no-default-active-elevate shadow-glow-sm" data-testid="badge-ledger-status">
            Validated
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-primary/10 cyber-border">
                <Layers className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Ledger Index</p>
                <p className="text-lg font-mono font-semibold text-primary text-glow" data-testid="text-ledger-index">
                  {ledger.ledgerIndex.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-primary/10 cyber-border">
                <Hash className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Ledger Hash</p>
                <p className="text-sm font-mono text-primary/80" data-testid="text-ledger-hash" title={ledger.ledgerHash}>
                  {formatHash(ledger.ledgerHash)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-primary/10 cyber-border">
                <Clock className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Close Time</p>
                <p className="text-sm" data-testid="text-close-time">
                  {ledger.closeTimeHuman || formatCloseTime(ledger.closeTime)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-primary/10 cyber-border">
                <ArrowRightLeft className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Transactions</p>
                <p className="text-lg font-semibold font-mono text-primary text-glow" data-testid="text-tx-count">
                  {ledger.transactionCount}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-primary/10 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Parent Hash</span>
              <span className="text-xs font-mono text-primary/70" data-testid="text-parent-hash" title={ledger.parentHash}>
                {formatHash(ledger.parentHash)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Account Hash</span>
              <span className="text-xs font-mono text-primary/70" data-testid="text-account-hash" title={ledger.accountHash}>
                {formatHash(ledger.accountHash)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Tx Hash</span>
              <span className="text-xs font-mono text-primary/70" data-testid="text-tx-hash" title={ledger.txHash}>
                {formatHash(ledger.txHash)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Total Coins (drops)</span>
              <span className="text-xs font-mono text-primary/70" data-testid="text-total-coins">
                {ledger.totalCoins ? Number(ledger.totalCoins).toLocaleString() : "N/A"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function RecentLedgersTable({ currentLedger }: { currentLedger: LedgerInfo }) {
  const recentLedgers = Array.from({ length: 10 }, (_, i) => ({
    index: currentLedger.ledgerIndex - i,
    isCurrent: i === 0,
  }));

  return (
    <motion.div variants={itemVariants}>
      <Card className="cyber-border relative overflow-visible">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium tracking-wide uppercase">Recent Ledgers</CardTitle>
          <FileText className="w-4 h-4 text-primary/60" />
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {recentLedgers.map((l, i) => (
              <motion.div
                key={l.index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                className={`flex items-center justify-between gap-2 p-2 rounded-md ${l.isCurrent ? "bg-primary/5 cyber-border" : ""}`}
                data-testid={`row-ledger-${l.index}`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="relative flex h-2 w-2">
                    <span className={`absolute inline-flex h-full w-full rounded-full ${l.isCurrent ? "bg-primary animate-ping opacity-40" : ""}`} />
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${l.isCurrent ? "bg-primary shadow-glow-sm" : "bg-primary/30"}`} />
                  </span>
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
                  <span className="text-xs text-muted-foreground font-mono">
                    {currentLedger.transactionCount} txns
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function CloseTimeChart() {
  const { data: snapshots } = useQuery<MetricsSnapshot[]>({
    queryKey: [`/api/metrics/history?hours=1`],
    refetchInterval: 30000,
  });

  const chartData = (snapshots || [])
    .filter((s) => s.closeTimeMs != null && s.closeTimeMs > 0)
    .map((s) => ({
      time: new Date(s.timestamp!).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" }),
      closeTime: Number((s.closeTimeMs! / 1000).toFixed(2)),
    }));

  if (chartData.length === 0) {
    return (
      <motion.div variants={itemVariants}>
        <Card className="cyber-border relative overflow-visible">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium tracking-wide uppercase">Ledger Close Times</CardTitle>
            <Clock className="w-4 h-4 text-primary/60" />
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              <p className="text-sm text-muted-foreground font-mono" data-testid="text-no-close-time-data">
                Collecting close time data...
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div variants={itemVariants}>
      <Card className="cyber-border relative overflow-visible">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium tracking-wide uppercase">Ledger Close Times</CardTitle>
          <Clock className="w-4 h-4 text-primary/60" />
        </CardHeader>
        <CardContent>
          <div className="h-64" data-testid="chart-close-times">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="closeTimeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                  <filter id="chartGlow">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  tickLine={false}
                />
                <YAxis
                  domain={["auto", "auto"]}
                  tickFormatter={(v) => `${v}s`}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid rgba(0, 230, 255, 0.2)",
                    borderRadius: "6px",
                    fontSize: "12px",
                    boxShadow: "0 0 15px rgba(0, 230, 255, 0.1)",
                  }}
                  formatter={(value: number) => [`${value.toFixed(2)}s`, "Close Time"]}
                />
                <Area
                  type="monotone"
                  dataKey="closeTime"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  fill="url(#closeTimeGradient)"
                  style={{ filter: "drop-shadow(0 0 4px hsl(var(--chart-1)))" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function LedgerSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Skeleton className="h-8 w-48 cyber-glow" />
        <Skeleton className="h-5 w-20 cyber-glow" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-72 cyber-glow" />
        <Skeleton className="h-72 cyber-glow" />
      </div>
      <Skeleton className="h-72 cyber-glow" />
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
          <BookOpen className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-semibold uppercase tracking-widest text-glow">Ledger Explorer</h1>
        </div>
        <div className="neon-line" />
        <Card className="cyber-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="w-12 h-12 text-primary/30 mb-4" />
            <p className="text-muted-foreground text-center font-mono" data-testid="text-ledger-error">
              {data?.message || "Unable to connect to XRPL node. Check your connection settings."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <motion.div
      className="p-6 space-y-6 overflow-auto h-full"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants} className="flex items-center gap-3 flex-wrap">
        <BookOpen className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-semibold uppercase tracking-widest text-glow" data-testid="text-page-title">
          Ledger Explorer
        </h1>
      </motion.div>

      <motion.div variants={itemVariants}>
        <div className="neon-line" />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LedgerDetailCard ledger={ledger} />
        <RecentLedgersTable currentLedger={ledger} />
      </div>

      <CloseTimeChart />
    </motion.div>
  );
}
