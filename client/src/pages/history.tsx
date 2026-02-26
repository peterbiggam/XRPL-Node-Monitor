/**
 * History Page — Displays historical metrics charts with time-range selection.
 *
 * Features:
 * - Configurable time window (1 H / 6 H / 24 H / 7 D) that controls the API query
 * - Core metric charts: CPU load, memory, peer count, ledger close time, load factor
 * - Extended metric charts: node latency, TPS, base fee
 * - Latency heatmap: time-bucketed grid cells color-coded by avg latency
 * - CSV / JSON export buttons (open the export API in a new tab)
 *
 * Each chart is configured via a ChartConfig object that maps a MetricsSnapshot
 * field to a Recharts AreaChart with a gradient fill and glow filter.
 */
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { motion } from "framer-motion";
import { Cpu, MemoryStick, Users, Clock, Gauge, Download, Activity, Zap, DollarSign } from "lucide-react";
import type { MetricsSnapshot } from "@shared/schema";

/** Time-range selector options — label shown in UI, value is hours for the API. */
const TIME_RANGES = [
  { label: "1H", value: 1 },
  { label: "6H", value: 6 },
  { label: "24H", value: 24 },
  { label: "7D", value: 168 },
] as const;

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

function formatTime(timestamp: string, hours: number): string {
  const d = new Date(timestamp);
  if (hours <= 1) {
    return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });
  }
  if (hours <= 24) {
    return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " +
    d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });
}

/**
 * ChartConfig — Declarative description for each metrics chart.
 * dataKey selects the field from MetricsSnapshot; domain can pin the Y axis.
 */
interface ChartConfig {
  title: string;
  icon: typeof Cpu;
  dataKey: keyof MetricsSnapshot;
  color: string;
  glowColor: string;
  unit: string;
  domain?: [number, number];
}

/** Core infrastructure charts shown in the primary grid. */
const CHARTS: ChartConfig[] = [
  {
    title: "CPU LOAD",
    icon: Cpu,
    dataKey: "cpuLoad",
    color: "hsl(185, 100%, 50%)",
    glowColor: "rgba(0, 230, 255, 0.3)",
    unit: "%",
    domain: [0, 100],
  },
  {
    title: "MEMORY USAGE",
    icon: MemoryStick,
    dataKey: "memoryPercent",
    color: "hsl(270, 80%, 65%)",
    glowColor: "rgba(167, 100, 255, 0.3)",
    unit: "%",
    domain: [0, 100],
  },
  {
    title: "PEER COUNT",
    icon: Users,
    dataKey: "peerCount",
    color: "hsl(120, 80%, 55%)",
    glowColor: "rgba(80, 230, 80, 0.3)",
    unit: "",
  },
  {
    title: "LEDGER CLOSE TIME",
    icon: Clock,
    dataKey: "closeTimeMs",
    color: "hsl(330, 90%, 60%)",
    glowColor: "rgba(255, 70, 150, 0.3)",
    unit: "ms",
  },
  {
    title: "LOAD FACTOR",
    icon: Gauge,
    dataKey: "loadFactor",
    color: "hsl(40, 95%, 55%)",
    glowColor: "rgba(255, 190, 50, 0.3)",
    unit: "",
  },
];

/** Extended metrics charts shown in a secondary grid below the heatmap. */
const NEW_CHARTS: ChartConfig[] = [
  {
    title: "NODE LATENCY",
    icon: Activity,
    dataKey: "nodeLatencyMs",
    color: "hsl(200, 100%, 60%)",
    glowColor: "rgba(50, 180, 255, 0.3)",
    unit: "ms",
  },
  {
    title: "TRANSACTIONS PER SECOND",
    icon: Zap,
    dataKey: "tps",
    color: "hsl(60, 90%, 55%)",
    glowColor: "rgba(240, 230, 50, 0.3)",
    unit: "",
  },
  {
    title: "BASE FEE",
    icon: DollarSign,
    dataKey: "baseFee",
    color: "hsl(150, 80%, 50%)",
    glowColor: "rgba(50, 210, 130, 0.3)",
    unit: " drops",
  },
];

function CustomTooltip({ active, payload, label, unit }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-md p-2 text-xs font-mono" style={{ boxShadow: "0 0 15px rgba(0,0,0,0.3)" }}>
      <p className="text-muted-foreground mb-1">{label}</p>
      <p className="text-foreground">
        {typeof payload[0].value === "number" ? payload[0].value.toFixed(2) : payload[0].value}{unit}
      </p>
    </div>
  );
}

function MetricsChart({ config, data, hours }: {
  config: ChartConfig;
  data: MetricsSnapshot[];
  hours: number;
}) {
  const Icon = config.icon;

  const chartData = data
    .filter((d) => d[config.dataKey] != null)
    .map((d) => ({
      time: formatTime(d.timestamp as unknown as string, hours),
      value: d[config.dataKey] as number,
    }));

  if (chartData.length === 0) {
    return (
      <Card className="cyber-border">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-xs tracking-widest uppercase font-mono flex items-center gap-2">
            <Icon className="w-4 h-4 text-muted-foreground" />
            {config.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 flex items-center justify-center min-h-[200px]">
          <span className="text-muted-foreground text-xs font-mono">NO DATA AVAILABLE</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="cyber-border">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-xs tracking-widest uppercase font-mono flex items-center gap-2 flex-wrap">
          <Icon className="w-4 h-4" style={{ color: config.color }} />
          {config.title}
        </CardTitle>
        <span className="text-lg font-mono font-bold" style={{ color: config.color, textShadow: `0 0 10px ${config.glowColor}` }} data-testid={`text-latest-${config.dataKey}`}>
          {chartData.length > 0 ? chartData[chartData.length - 1].value.toFixed(1) : "—"}{config.unit}
        </span>
      </CardHeader>
      <CardContent className="p-4">
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
              <defs>
                <linearGradient id={`gradient-${config.dataKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={config.color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={config.color} stopOpacity={0.02} />
                </linearGradient>
                <filter id={`glow-${config.dataKey}`}>
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                domain={config.domain || ["auto", "auto"]}
                width={40}
              />
              <Tooltip content={<CustomTooltip unit={config.unit} />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke={config.color}
                strokeWidth={2}
                fill={`url(#gradient-${config.dataKey})`}
                filter={`url(#glow-${config.dataKey})`}
                dot={false}
                activeDot={{ r: 4, fill: config.color, stroke: config.color, strokeWidth: 2, style: { filter: `drop-shadow(0 0 6px ${config.glowColor})` } }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Latency heatmap helpers ---

/** Map a latency value to an HSL color on a green→red gradient. */
function getLatencyColor(latencyMs: number): string {
  if (latencyMs <= 50) return "hsl(120, 80%, 40%)";
  if (latencyMs <= 100) return "hsl(120, 60%, 35%)";
  if (latencyMs <= 200) return "hsl(80, 70%, 40%)";
  if (latencyMs <= 500) return "hsl(45, 90%, 45%)";
  if (latencyMs <= 1000) return "hsl(30, 90%, 45%)";
  return "hsl(0, 80%, 45%)";
}

function getLatencyLabel(latencyMs: number): string {
  if (latencyMs <= 50) return "Excellent";
  if (latencyMs <= 100) return "Good";
  if (latencyMs <= 200) return "Fair";
  if (latencyMs <= 500) return "Slow";
  if (latencyMs <= 1000) return "Poor";
  return "Critical";
}

interface HeatmapBucket {
  timeLabel: string;
  avgLatency: number;
  count: number;
}

/**
 * Divide the selected time window into fixed-size buckets and compute the
 * average latency within each bucket.  Bucket size adapts to the time range
 * (5 min for 1 H, up to 2 h for 7 D) so the grid stays a reasonable width.
 * Returns -1 for avgLatency when a bucket has no data points.
 */
function buildHeatmapBuckets(data: MetricsSnapshot[], hours: number): HeatmapBucket[] {
  if (!data.length) return [];

  const bucketMinutes = hours <= 1 ? 5 : hours <= 6 ? 15 : hours <= 24 ? 30 : 120;
  const bucketMs = bucketMinutes * 60 * 1000;

  const now = Date.now();
  const start = now - hours * 60 * 60 * 1000;
  const bucketCount = Math.ceil((now - start) / bucketMs);

  const buckets: { sum: number; count: number; time: number }[] = Array.from(
    { length: bucketCount },
    (_, i) => ({ sum: 0, count: 0, time: start + i * bucketMs })
  );

  for (const snapshot of data) {
    if (snapshot.nodeLatencyMs == null) continue;
    const ts = new Date(snapshot.timestamp as unknown as string).getTime();
    const idx = Math.floor((ts - start) / bucketMs);
    if (idx >= 0 && idx < buckets.length) {
      buckets[idx].sum += snapshot.nodeLatencyMs;
      buckets[idx].count++;
    }
  }

  return buckets.map((b) => {
    const d = new Date(b.time);
    let timeLabel: string;
    if (hours <= 24) {
      timeLabel = d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });
    } else {
      timeLabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " +
        d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });
    }
    return {
      timeLabel,
      avgLatency: b.count > 0 ? b.sum / b.count : -1,
      count: b.count,
    };
  });
}

function LatencyHeatmap({ data, hours }: { data: MetricsSnapshot[]; hours: number }) {
  const buckets = buildHeatmapBuckets(data, hours);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (buckets.length === 0 || buckets.every((b) => b.avgLatency < 0)) {
    return (
      <Card className="cyber-border">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-xs tracking-widest uppercase font-mono flex items-center gap-2 flex-wrap">
            <Activity className="w-4 h-4" style={{ color: "hsl(200, 100%, 60%)" }} />
            LATENCY HEATMAP
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 flex items-center justify-center min-h-[120px]">
          <span className="text-muted-foreground text-xs font-mono" data-testid="text-heatmap-empty">NO LATENCY DATA AVAILABLE</span>
        </CardContent>
      </Card>
    );
  }

  const legendItems = [
    { label: "< 50ms", color: getLatencyColor(25) },
    { label: "50-100ms", color: getLatencyColor(75) },
    { label: "100-200ms", color: getLatencyColor(150) },
    { label: "200-500ms", color: getLatencyColor(300) },
    { label: "500ms-1s", color: getLatencyColor(750) },
    { label: "> 1s", color: getLatencyColor(1500) },
  ];

  return (
    <Card className="cyber-border" data-testid="card-latency-heatmap">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-xs tracking-widest uppercase font-mono flex items-center gap-2 flex-wrap">
          <Activity className="w-4 h-4" style={{ color: "hsl(200, 100%, 60%)" }} />
          LATENCY HEATMAP
        </CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          {legendItems.map((item) => (
            <div key={item.label} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-md" style={{ backgroundColor: item.color }} />
              <span className="text-[10px] font-mono text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="relative">
          <div className="flex flex-wrap gap-1" data-testid="heatmap-grid">
            {buckets.map((bucket, i) => (
              <div
                key={i}
                className="relative rounded-md transition-transform duration-150"
                style={{
                  width: "clamp(16px, 2.5vw, 28px)",
                  height: "clamp(16px, 2.5vw, 28px)",
                  backgroundColor: bucket.avgLatency >= 0 ? getLatencyColor(bucket.avgLatency) : "hsl(var(--muted))",
                  opacity: bucket.avgLatency >= 0 ? 1 : 0.2,
                  boxShadow: bucket.avgLatency >= 0 ? `0 0 6px ${getLatencyColor(bucket.avgLatency)}40` : "none",
                }}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                data-testid={`heatmap-cell-${i}`}
              />
            ))}
          </div>
          {hoveredIdx !== null && buckets[hoveredIdx] && (
            <div
              className="absolute z-50 bg-card border border-border rounded-md p-2 text-xs font-mono pointer-events-none"
              style={{
                top: "-60px",
                left: "50%",
                transform: "translateX(-50%)",
                boxShadow: "0 0 15px rgba(0,0,0,0.4)",
              }}
              data-testid="heatmap-tooltip"
            >
              <p className="text-muted-foreground">{buckets[hoveredIdx].timeLabel}</p>
              {buckets[hoveredIdx].avgLatency >= 0 ? (
                <>
                  <p className="text-foreground">{buckets[hoveredIdx].avgLatency.toFixed(1)}ms avg</p>
                  <p className="text-muted-foreground">{getLatencyLabel(buckets[hoveredIdx].avgLatency)} ({buckets[hoveredIdx].count} samples)</p>
                </>
              ) : (
                <p className="text-muted-foreground">No data</p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function HistorySkeleton() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i} className="cyber-border">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-6 w-16" />
          </CardHeader>
          <CardContent className="p-4">
            <Skeleton className="h-[200px] w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function HistoryPage() {
  const [hours, setHours] = useState(24);

  const { data, isLoading } = useQuery<MetricsSnapshot[]>({
    queryKey: [`/api/metrics/history?hours=${hours}`],
    refetchInterval: 30000,
  });

  return (
    <motion.div
      className="p-4 space-y-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants} className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="text-lg font-bold tracking-tight font-mono text-glow"
            data-testid="text-page-title"
          >
            METRICS HISTORY
          </h1>
          <p className="text-xs text-muted-foreground font-mono tracking-wider">
            HISTORICAL NODE PERFORMANCE DATA
          </p>
        </div>
        <div className="flex items-center gap-2" data-testid="controls-time-range">
          <div className="flex items-center gap-1">
            {TIME_RANGES.map((range) => (
              <Button
                key={range.value}
                variant={hours === range.value ? "default" : "ghost"}
                size="sm"
                onClick={() => setHours(range.value)}
                className={`font-mono text-xs ${hours === range.value ? "cyber-glow" : ""}`}
                data-testid={`button-range-${range.label.toLowerCase()}`}
              >
                {range.label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-1 border-l border-border pl-2">
            <Button
              variant="ghost"
              size="sm"
              className="font-mono text-xs"
              onClick={() => {
                window.open(`/api/export/report?hours=${hours}&format=csv`, "_blank");
              }}
              data-testid="button-export-csv"
            >
              <Download className="w-3 h-3 mr-1" />
              CSV
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="font-mono text-xs"
              onClick={() => {
                window.open(`/api/export/report?hours=${hours}`, "_blank");
              }}
              data-testid="button-export-json"
            >
              <Download className="w-3 h-3 mr-1" />
              JSON
            </Button>
          </div>
        </div>
      </motion.div>

      {isLoading ? (
        <HistorySkeleton />
      ) : (
        <motion.div
          className="grid grid-cols-1 xl:grid-cols-2 gap-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {CHARTS.map((config) => (
            <motion.div key={config.dataKey} variants={itemVariants}>
              <MetricsChart
                config={config}
                data={data || []}
                hours={hours}
              />
            </motion.div>
          ))}
        </motion.div>
      )}

      {!isLoading && data && data.length > 0 && (
        <>
          <motion.div variants={itemVariants}>
            <LatencyHeatmap data={data} hours={hours} />
          </motion.div>

          <motion.div variants={itemVariants}>
            <h2
              className="text-sm font-bold tracking-widest font-mono text-glow uppercase"
              data-testid="text-extended-metrics-title"
            >
              EXTENDED METRICS
            </h2>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 xl:grid-cols-2 gap-4"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {NEW_CHARTS.map((config) => (
              <motion.div key={config.dataKey} variants={itemVariants}>
                <MetricsChart
                  config={config}
                  data={data}
                  hours={hours}
                />
              </motion.div>
            ))}
          </motion.div>
        </>
      )}

      {!isLoading && (!data || data.length === 0) && (
        <motion.div variants={itemVariants}>
          <Card className="cyber-border">
            <CardContent className="p-8 flex flex-col items-center justify-center gap-3">
              <Clock className="w-8 h-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground font-mono text-center">
                No metrics data recorded yet. Snapshots are captured every 30 seconds.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
