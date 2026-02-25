import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GitCompare, Server, Settings, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface ComparedNode {
  id: number;
  name: string;
  host: string;
  status: string;
  latency: number;
  serverState: string;
  peers: number;
  ledgerSeq: number;
  ledgerAge: number;
  uptime: number;
  buildVersion: string;
  loadFactor: number;
}

const metricRows = [
  { key: "status", label: "Status" },
  { key: "serverState", label: "Server State" },
  { key: "host", label: "Host" },
  { key: "buildVersion", label: "Version" },
  { key: "latency", label: "Latency (ms)" },
  { key: "peers", label: "Peers" },
  { key: "ledgerSeq", label: "Ledger Seq" },
  { key: "ledgerAge", label: "Ledger Age (s)" },
  { key: "uptime", label: "Uptime (s)" },
  { key: "loadFactor", label: "Load Factor" },
] as const;

function formatUptime(seconds: number): string {
  if (!seconds || seconds <= 0) return "N/A";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function CellValue({ node, metricKey }: { node: ComparedNode; metricKey: string }) {
  const value = node[metricKey as keyof ComparedNode];

  if (metricKey === "status") {
    const connected = value === "connected";
    return (
      <Badge
        variant={connected ? "default" : "destructive"}
        className="no-default-active-elevate font-mono text-[10px]"
        data-testid={`status-node-${node.id}`}
      >
        {connected ? "Connected" : "Disconnected"}
      </Badge>
    );
  }

  if (metricKey === "uptime") {
    return (
      <span className="font-mono text-xs" data-testid={`text-uptime-${node.id}`}>
        {formatUptime(value as number)}
      </span>
    );
  }

  if (metricKey === "latency") {
    const lat = value as number;
    const color = lat < 100 ? "text-green-400" : lat < 500 ? "text-yellow-400" : "text-red-400";
    return (
      <span className={`font-mono text-xs ${color}`} data-testid={`text-latency-${node.id}`}>
        {lat > 0 ? `${lat}ms` : "N/A"}
      </span>
    );
  }

  if (metricKey === "serverState") {
    const state = value as string;
    const color = state === "full" ? "text-green-400" : state === "proposing" ? "text-primary" : "text-yellow-400";
    return (
      <span className={`font-mono text-xs ${color}`} data-testid={`text-state-${node.id}`}>
        {state || "N/A"}
      </span>
    );
  }

  if (metricKey === "loadFactor") {
    const lf = value as number;
    const color = lf <= 1 ? "text-green-400" : lf <= 2 ? "text-yellow-400" : "text-red-400";
    return (
      <span className={`font-mono text-xs ${color}`} data-testid={`text-load-${node.id}`}>
        {lf ?? "N/A"}
      </span>
    );
  }

  return (
    <span className="font-mono text-xs" data-testid={`text-${metricKey}-${node.id}`}>
      {value != null ? String(value) : "N/A"}
    </span>
  );
}

export default function ComparisonPage() {
  const { data: nodes, isLoading, isError } = useQuery<ComparedNode[]>({
    queryKey: ["/api/nodes/compare"],
    refetchInterval: 15000,
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <GitCompare className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold font-mono tracking-tight text-glow" data-testid="text-comparison-title">
            NODE COMPARISON
          </h1>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !nodes || nodes.length === 0) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <GitCompare className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold font-mono tracking-tight text-glow" data-testid="text-comparison-title">
            NODE COMPARISON
          </h1>
        </div>
        <Card className="cyber-border">
          <CardContent className="p-8 flex flex-col items-center gap-4">
            <AlertTriangle className="w-10 h-10 text-muted-foreground" />
            <p className="font-mono text-sm text-muted-foreground text-center" data-testid="text-no-nodes">
              No saved nodes found. Add nodes in Settings to compare them.
            </p>
            <Link href="/settings">
              <Button variant="outline" className="font-mono text-xs gap-2" data-testid="link-go-settings">
                <Settings className="w-4 h-4" />
                Go to Settings
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <GitCompare className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold font-mono tracking-tight text-glow" data-testid="text-comparison-title">
          NODE COMPARISON
        </h1>
        <Badge variant="secondary" className="no-default-active-elevate font-mono text-[10px]" data-testid="badge-node-count">
          {nodes.length} nodes
        </Badge>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="cyber-border overflow-visible">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <Server className="w-4 h-4 text-primary" />
            <CardTitle className="font-mono text-sm tracking-wider" data-testid="text-table-title">
              SIDE-BY-SIDE COMPARISON
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="table-comparison">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left p-3 font-mono text-[10px] tracking-widest uppercase text-muted-foreground sticky left-0 bg-card z-10">
                      Metric
                    </th>
                    {nodes.map((node) => (
                      <th
                        key={node.id}
                        className="text-center p-3 font-mono text-xs min-w-[140px]"
                        data-testid={`header-node-${node.id}`}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <span className={`font-bold ${node.status === "connected" ? "text-primary text-glow" : "text-destructive"}`}>
                            {node.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{node.host}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metricRows.map((row, idx) => (
                    <tr
                      key={row.key}
                      className={`border-b border-border/20 ${idx % 2 === 0 ? "" : "bg-muted/10"}`}
                      data-testid={`row-metric-${row.key}`}
                    >
                      <td className="p-3 font-mono text-[10px] tracking-widest uppercase text-muted-foreground sticky left-0 bg-card z-10">
                        {row.label}
                      </td>
                      {nodes.map((node) => (
                        <td key={node.id} className="p-3 text-center">
                          <CellValue node={node} metricKey={row.key} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
