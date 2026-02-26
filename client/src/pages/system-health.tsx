/**
 * System Health Page — Real-time host-machine diagnostics.
 *
 * Cards:
 * - CPU: circular gauge for current load, model, core count, load average
 * - Memory: circular gauge + ResourceBar for RAM usage
 * - Disk: per-partition usage bars
 * - Network I/O: live-updating stacked area chart (RX/TX bytes/sec), built from
 *   a rolling buffer of the last 30 data points (polled every 3 s)
 * - System Uptime: large digital clock-style display (DD:HH:MM)
 * - OS Information: platform, hostname, kernel, architecture
 */
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CircularGauge } from "@/components/circular-gauge";
import { ResourceBar } from "@/components/resource-bar";
import { Cpu, HardDrive, MemoryStick, Network, Clock, Monitor } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
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

function formatUptimeDigital(seconds: number): { days: string; hours: string; mins: string } {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return {
    days: String(days).padStart(2, "0"),
    hours: String(hours).padStart(2, "0"),
    mins: String(mins).padStart(2, "0"),
  };
}

interface NetworkDataPoint {
  time: string;
  rxSec: number;
  txSec: number;
}

/** Rolling buffer depth for the network I/O chart (one point every ~3 s). */
const MAX_NETWORK_POINTS = 30;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

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
        <h1 className="text-xl font-semibold uppercase tracking-widest text-glow">System Diagnostics</h1>
        <div className="neon-line" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="cyber-border">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <Skeleton className="h-5 w-24 cyber-glow" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-32 w-full cyber-glow" />
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

  const uptime = formatUptimeDigital(metrics.uptime);

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full" data-testid="system-health-page">
      <div className="space-y-2">
        <h1
          className="text-xl font-semibold uppercase tracking-widest text-glow"
          data-testid="text-page-title"
          style={{ color: "hsl(var(--primary))" }}
        >
          System Diagnostics
        </h1>
        <div className="neon-line" />
      </div>

      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants}>
          <Card className="cyber-border hover:cyber-glow transition-shadow duration-300" data-testid="card-cpu">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 flex-wrap uppercase tracking-wider">
                <Cpu className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />
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
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="cyber-border hover:cyber-glow transition-shadow duration-300" data-testid="card-memory">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 flex-wrap uppercase tracking-wider">
                <MemoryStick className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />
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
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="cyber-border hover:cyber-glow transition-shadow duration-300" data-testid="card-disk">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 flex-wrap uppercase tracking-wider">
                <HardDrive className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />
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
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="cyber-border hover:cyber-glow transition-shadow duration-300" data-testid="card-network">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 flex-wrap uppercase tracking-wider">
                <Network className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />
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
                          <linearGradient id="rxGradGlow" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="txGradGlow" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                          </linearGradient>
                          <filter id="chartGlow">
                            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                          </filter>
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
                            border: "1px solid rgba(0, 230, 255, 0.2)",
                            borderRadius: "0.375rem",
                            fontSize: "12px",
                            boxShadow: "0 0 15px rgba(0, 230, 255, 0.1)",
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
                          fill="url(#rxGradGlow)"
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={false}
                          filter="url(#chartGlow)"
                        />
                        <Area
                          type="monotone"
                          dataKey="txSec"
                          stroke="hsl(var(--chart-2))"
                          fill="url(#txGradGlow)"
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={false}
                          filter="url(#chartGlow)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-48">
                    <p className="text-sm text-muted-foreground animate-pulse-glow">Collecting network data...</p>
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
        </motion.div>
      </motion.div>

      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants}>
          <Card className="cyber-border hover:cyber-glow transition-shadow duration-300" data-testid="card-uptime">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 flex-wrap uppercase tracking-wider">
                <Clock className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />
                System Uptime
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center py-4">
                <div className="flex items-baseline gap-1 font-mono" data-testid="text-uptime">
                  <span className="text-4xl font-bold text-glow" style={{ color: "hsl(var(--primary))" }}>
                    {uptime.days}
                  </span>
                  <span className="text-lg text-muted-foreground">D</span>
                  <span className="text-2xl text-muted-foreground mx-1">:</span>
                  <span className="text-4xl font-bold text-glow" style={{ color: "hsl(var(--primary))" }}>
                    {uptime.hours}
                  </span>
                  <span className="text-lg text-muted-foreground">H</span>
                  <span className="text-2xl text-muted-foreground mx-1">:</span>
                  <span className="text-4xl font-bold text-glow" style={{ color: "hsl(var(--primary))" }}>
                    {uptime.mins}
                  </span>
                  <span className="text-lg text-muted-foreground">M</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground text-center font-mono">
                {Math.floor(metrics.uptime / 86400)} days running
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="cyber-border hover:cyber-glow transition-shadow duration-300" data-testid="card-os-info">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 flex-wrap uppercase tracking-wider">
                <Monitor className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />
                OS Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 font-mono text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-muted-foreground select-none">{">_"}</span>
                  <span className="text-muted-foreground">platform:</span>
                  <span data-testid="text-os-platform">{metrics.os.platform}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-muted-foreground select-none">{">_"}</span>
                  <span className="text-muted-foreground">hostname:</span>
                  <span data-testid="text-os-hostname">{metrics.os.hostname}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-muted-foreground select-none">{">_"}</span>
                  <span className="text-muted-foreground">kernel:</span>
                  <span className="truncate max-w-[200px]" data-testid="text-os-kernel">
                    {metrics.os.kernel}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-muted-foreground select-none">{">_"}</span>
                  <span className="text-muted-foreground">arch:</span>
                  <span data-testid="text-os-arch">{metrics.os.arch}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
