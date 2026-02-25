import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CircularGauge } from "@/components/circular-gauge";
import { ResourceBar } from "@/components/resource-bar";
import { Cpu, HardDrive, MemoryStick, Network, Clock, Monitor } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { SystemMetrics } from "@shared/schema";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatBytesPerSec(bytes: number): string {
  if (bytes === 0) return "0 B/s";
  const k = 1024;
  const sizes = ["B/s", "KB/s", "MB/s", "GB/s"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${mins}m`);
  return parts.join(" ");
}

interface NetworkDataPoint {
  time: string;
  rxSec: number;
  txSec: number;
}

const MAX_NETWORK_POINTS = 30;

export default function SystemHealthPage() {
  const [networkHistory, setNetworkHistory] = useState<NetworkDataPoint[]>([]);
  const prevDataRef = useRef<SystemMetrics | null>(null);

  const { data: metrics, isLoading, isError } = useQuery<SystemMetrics>({
    queryKey: ["/api/system/metrics"],
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (metrics && metrics.network && metrics !== prevDataRef.current) {
      prevDataRef.current = metrics;
      const totalRx = metrics.network.reduce((sum, n) => sum + n.rxSec, 0);
      const totalTx = metrics.network.reduce((sum, n) => sum + n.txSec, 0);
      const now = new Date();
      const timeStr = `${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;

      setNetworkHistory((prev) => {
        const next = [...prev, { time: timeStr, rxSec: totalRx, txSec: totalTx }];
        return next.slice(-MAX_NETWORK_POINTS);
      });
    }
  }, [metrics]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 overflow-y-auto h-full" data-testid="system-health-loading">
        <h1 className="text-xl font-semibold">System Health</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <Skeleton className="h-5 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (isError || !metrics) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="system-health-error">
        <div className="text-center space-y-2">
          <Monitor className="w-10 h-10 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Unable to load system metrics</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full" data-testid="system-health-page">
      <h1 className="text-xl font-semibold" data-testid="text-page-title">System Health</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card data-testid="card-cpu">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 flex-wrap">
              <Cpu className="w-4 h-4 text-muted-foreground" />
              CPU Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <CircularGauge
                  value={metrics.cpu.currentLoad}
                  label="Current Load"
                />
              </div>
              <div className="w-full space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">Model</span>
                  <span className="text-sm font-mono truncate max-w-[200px]" data-testid="text-cpu-model">
                    {metrics.cpu.model}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">Cores</span>
                  <span className="text-sm font-mono" data-testid="text-cpu-cores">{metrics.cpu.cores}</span>
                </div>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">Load Average</span>
                  <span className="text-sm font-mono" data-testid="text-cpu-avg">{metrics.cpu.avgLoad.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-memory">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 flex-wrap">
              <MemoryStick className="w-4 h-4 text-muted-foreground" />
              Memory Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <CircularGauge
                  value={metrics.memory.usedPercent}
                  label="Used"
                />
              </div>
              <div className="w-full">
                <ResourceBar
                  label="RAM"
                  used={formatBytes(metrics.memory.used)}
                  total={formatBytes(metrics.memory.total)}
                  percent={metrics.memory.usedPercent}
                />
              </div>
              <div className="w-full flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Free</span>
                <span className="text-sm font-mono" data-testid="text-memory-free">
                  {formatBytes(metrics.memory.free)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-disk">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 flex-wrap">
              <HardDrive className="w-4 h-4 text-muted-foreground" />
              Disk Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.disk.length > 0 ? (
                metrics.disk.map((d, i) => (
                  <div key={i} data-testid={`disk-partition-${i}`}>
                    <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                      <span className="text-xs text-muted-foreground font-mono truncate max-w-[180px]">
                        {d.mount}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono truncate max-w-[180px]">
                        {d.fs}
                      </span>
                    </div>
                    <ResourceBar
                      label={d.mount}
                      used={formatBytes(d.used)}
                      total={formatBytes(d.size)}
                      percent={d.usedPercent}
                    />
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No disk data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-network">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 flex-wrap">
              <Network className="w-4 h-4 text-muted-foreground" />
              Network I/O
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {networkHistory.length > 1 ? (
                <div className="h-48" data-testid="chart-network-io">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={networkHistory}>
                      <defs>
                        <linearGradient id="rxGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="txGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        stroke="hsl(var(--border))"
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        stroke="hsl(var(--border))"
                        tickFormatter={(v: number) => formatBytesPerSec(v)}
                        width={70}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "0.375rem",
                          fontSize: "12px",
                        }}
                        formatter={(value: number, name: string) => [
                          formatBytesPerSec(value),
                          name === "rxSec" ? "Download" : "Upload",
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="rxSec"
                        stroke="hsl(var(--chart-1))"
                        fill="url(#rxGrad)"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="txSec"
                        stroke="hsl(var(--chart-2))"
                        fill="url(#txGrad)"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-48">
                  <p className="text-sm text-muted-foreground">Collecting network data...</p>
                </div>
              )}

              <div className="space-y-2">
                {metrics.network.map((n, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 flex-wrap text-sm"
                    data-testid={`network-iface-${i}`}
                  >
                    <span className="font-mono text-muted-foreground">{n.iface}</span>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-xs">
                        RX: {formatBytes(n.rxBytes)}
                      </span>
                      <span className="font-mono text-xs">
                        TX: {formatBytes(n.txBytes)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card data-testid="card-uptime">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 flex-wrap">
              <Clock className="w-4 h-4 text-muted-foreground" />
              System Uptime
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-mono font-bold" data-testid="text-uptime">
              {formatUptime(metrics.uptime)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {Math.floor(metrics.uptime / 86400)} days running
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-os-info">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 flex-wrap">
              <Monitor className="w-4 h-4 text-muted-foreground" />
              OS Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Platform</span>
                <span className="text-sm font-mono" data-testid="text-os-platform">{metrics.os.platform}</span>
              </div>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Hostname</span>
                <span className="text-sm font-mono" data-testid="text-os-hostname">{metrics.os.hostname}</span>
              </div>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Kernel</span>
                <span className="text-sm font-mono truncate max-w-[200px]" data-testid="text-os-kernel">
                  {metrics.os.kernel}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Architecture</span>
                <span className="text-sm font-mono" data-testid="text-os-arch">{metrics.os.arch}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
