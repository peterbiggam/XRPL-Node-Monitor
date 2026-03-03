/**
 * Peers Page — Visualises the node's peer connections in three tabs.
 *
 * Tabs (order):
 * 1. Map — Geolocation world map with detailed continent outlines.
 *    Peer dots are clickable — opens a detail panel (Sheet) with full peer info.
 * 2. Graph — Force-directed SVG network graph. Inbound peers cluster left,
 *    outbound cluster right. Spring + repulsion physics run for 200 iterations.
 * 3. Table — Sortable data table with IP (partially masked), version, uptime, latency.
 *
 * Also includes a donut chart of peer version distribution.
 */
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Users, ArrowDownLeft, ArrowUpRight, Globe, Clock, Network, LayoutList, MapPin, X, Copy, ExternalLink, Activity, Server, Layers } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { PeerInfo } from "@shared/schema";

interface PeersResponse {
  status: string;
  data: PeerInfo[] | null;
  message?: string;
}

/** Partially mask an IP:port string for privacy (e.g. "192.168.***.***:51235"). */
function maskAddress(address: string): string {
  if (!address) return "N/A";
  const parts = address.split(":");
  if (parts.length < 2) return address;
  const ip = parts[0];
  const port = parts[parts.length - 1];
  const ipParts = ip.split(".");
  if (ipParts.length === 4) {
    return `${ipParts[0]}.${ipParts[1]}.***.***:${port}`;
  }
  return `${ip.slice(0, 8)}***:${port}`;
}

function formatUptime(seconds: number): string {
  if (!seconds) return "N/A";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function getLatencyColor(latency: number | undefined): string {
  if (!latency || latency <= 50) return "#22c55e";
  if (latency <= 150) return "#f59e0b";
  return "#ef4444";
}

function getLatencyLabel(latency: number | undefined): string {
  if (!latency || latency <= 50) return "Low";
  if (latency <= 150) return "Medium";
  return "High";
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

/** A node in the force-directed graph — either the center "YOUR NODE" or a peer. */
interface GraphNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  peer?: PeerInfo;
  isCenter: boolean;
}

function PeerSummary({ peers }: { peers: PeerInfo[] }) {
  const totalPeers = peers.length;
  const inbound = peers.filter((p) => p.inbound).length;
  const outbound = totalPeers - inbound;

  const stats = [
    { label: "Total Peers", value: totalPeers, icon: Users, testId: "text-total-peers" },
    { label: "Inbound", value: inbound, icon: ArrowDownLeft, testId: "text-inbound-peers" },
    { label: "Outbound", value: outbound, icon: ArrowUpRight, testId: "text-outbound-peers" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {stats.map((stat) => (
        <motion.div key={stat.label} variants={itemVariants}>
          <Card className="cyber-border relative overflow-visible">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
            <CardContent className="flex items-center gap-3 py-4">
              <div className="p-2 rounded-md bg-primary/10 cyber-border">
                <stat.icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                <p className="text-2xl font-semibold font-mono text-primary text-glow" data-testid={stat.testId}>
                  {stat.value}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

/** Generate an SVG path for a regular hexagon centered at (cx, cy) with radius r. */
function hexagonPath(cx: number, cy: number, r: number): string {
  const points: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return `M${points.join("L")}Z`;
}

/**
 * PeerNetworkGraph — Force-directed SVG visualisation of peer connections.
 * Runs a physics simulation (spring toward center + peer repulsion) for 200
 * iterations, updating node positions each frame.  Inbound peers are biased
 * to the left half; outbound to the right.
 */
function PeerNetworkGraph({ peers }: { peers: PeerInfo[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const animFrameRef = useRef<number>(0);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const nodesRef = useRef<GraphNode[]>([]);
  const [renderTick, setRenderTick] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: Math.max(rect.width, 400), height: Math.max(500, Math.min(rect.width * 0.6, 600)) });
      }
    };
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  const initNodes = useCallback(() => {
    const { width, height } = dimensions;
    const cx = width / 2;
    const cy = height / 2;

    const centerNode: GraphNode = {
      id: "center",
      x: cx,
      y: cy,
      vx: 0,
      vy: 0,
      isCenter: true,
    };

    const inboundPeers = peers.filter(p => p.inbound);
    const outboundPeers = peers.filter(p => !p.inbound);

    const peerNodes: GraphNode[] = [];

    inboundPeers.forEach((peer, i) => {
      const angle = ((i / Math.max(inboundPeers.length, 1)) * Math.PI) + Math.PI / 2;
      const radius = 120 + Math.random() * 60;
      peerNodes.push({
        id: peer.publicKey || `in-${i}`,
        x: cx - radius * Math.cos(angle) * 0.6 - 50,
        y: cy + radius * Math.sin(angle) * 0.8 - radius * 0.3,
        vx: 0,
        vy: 0,
        peer,
        isCenter: false,
      });
    });

    outboundPeers.forEach((peer, i) => {
      const angle = ((i / Math.max(outboundPeers.length, 1)) * Math.PI) + Math.PI / 2;
      const radius = 120 + Math.random() * 60;
      peerNodes.push({
        id: peer.publicKey || `out-${i}`,
        x: cx + radius * Math.cos(angle) * 0.6 + 50,
        y: cy + radius * Math.sin(angle) * 0.8 - radius * 0.3,
        vx: 0,
        vy: 0,
        peer,
        isCenter: false,
      });
    });

    nodesRef.current = [centerNode, ...peerNodes];
  }, [peers, dimensions]);

  useEffect(() => {
    initNodes();
  }, [initNodes]);

  useEffect(() => {
    let iteration = 0;
    const maxIterations = 200;
    const { width, height } = dimensions;
    const cx = width / 2;
    const cy = height / 2;

    const simulate = () => {
      if (iteration >= maxIterations) return;
      const nodes = nodesRef.current;
      const idealDistance = Math.min(width, height) * 0.3;

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (node.isCenter) continue;

        const dx = node.x - cx;
        const dy = node.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        const springForce = (dist - idealDistance) * 0.01;
        node.vx -= (dx / dist) * springForce;
        node.vy -= (dy / dist) * springForce;

        for (let j = i + 1; j < nodes.length; j++) {
          const other = nodes[j];
          if (other.isCenter) continue;
          const rdx = node.x - other.x;
          const rdy = node.y - other.y;
          const rDist = Math.sqrt(rdx * rdx + rdy * rdy) || 1;
          if (rDist < 80) {
            const repulsion = (80 - rDist) * 0.05;
            const rx = (rdx / rDist) * repulsion;
            const ry = (rdy / rDist) * repulsion;
            node.vx += rx;
            node.vy += ry;
            other.vx -= rx;
            other.vy -= ry;
          }
        }

        const isInbound = node.peer?.inbound;
        if (isInbound && node.x > cx - 20) {
          node.vx -= 0.5;
        } else if (!isInbound && node.x < cx + 20) {
          node.vx += 0.5;
        }

        node.vx *= 0.85;
        node.vy *= 0.85;
        node.x += node.vx;
        node.y += node.vy;

        const margin = 30;
        node.x = Math.max(margin, Math.min(width - margin, node.x));
        node.y = Math.max(margin, Math.min(height - margin, node.y));
      }

      iteration++;
      setRenderTick(t => t + 1);
      animFrameRef.current = requestAnimationFrame(simulate);
    };

    animFrameRef.current = requestAnimationFrame(simulate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [dimensions, peers]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let found: string | null = null;
    for (const node of nodesRef.current) {
      if (node.isCenter) continue;
      const dx = mx - node.x;
      const dy = my - node.y;
      if (Math.sqrt(dx * dx + dy * dy) < 18) {
        found = node.id;
        setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        break;
      }
    }
    setHoveredNode(found);
  }, []);

  const nodes = nodesRef.current;
  const hoveredPeer = nodes.find(n => n.id === hoveredNode)?.peer;

  return (
    <motion.div variants={itemVariants} ref={containerRef}>
      <Card className="cyber-border relative overflow-visible">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium tracking-wide uppercase">Network Topology</CardTitle>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#22c55e" }} />
              <span className="text-xs text-muted-foreground">Low</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#f59e0b" }} />
              <span className="text-xs text-muted-foreground">Med</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#ef4444" }} />
              <span className="text-xs text-muted-foreground">High</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative">
          <div className="flex justify-between px-4 mb-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-mono flex items-center gap-1">
              <ArrowDownLeft className="w-3 h-3" /> Inbound
            </span>
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-mono flex items-center gap-1">
              Outbound <ArrowUpRight className="w-3 h-3" />
            </span>
          </div>
          <svg
            ref={svgRef}
            width={dimensions.width}
            height={dimensions.height}
            className="w-full"
            viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredNode(null)}
            data-testid="svg-peer-graph"
          >
            <defs>
              <filter id="glow-center" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="glow-node" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <radialGradient id="center-gradient" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="hsl(185, 100%, 60%)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="hsl(185, 100%, 50%)" stopOpacity="0" />
              </radialGradient>
            </defs>

            <line
              x1={dimensions.width / 2}
              y1={20}
              x2={dimensions.width / 2}
              y2={dimensions.height - 20}
              stroke="hsl(185, 100%, 50%)"
              strokeOpacity="0.08"
              strokeDasharray="4 4"
            />

            {nodes.filter(n => !n.isCenter).map((node) => {
              const center = nodes[0];
              const latency = node.peer?.latency || 50;
              const thickness = Math.max(0.5, Math.min(3, 150 / latency));
              const color = getLatencyColor(node.peer?.latency);
              const isHovered = node.id === hoveredNode;
              return (
                <line
                  key={`line-${node.id}`}
                  x1={center.x}
                  y1={center.y}
                  x2={node.x}
                  y2={node.y}
                  stroke={color}
                  strokeWidth={isHovered ? thickness + 1 : thickness}
                  strokeOpacity={isHovered ? 0.7 : 0.25}
                />
              );
            })}

            {nodes.length > 0 && (
              <g filter="url(#glow-center)">
                <circle
                  cx={nodes[0].x}
                  cy={nodes[0].y}
                  r={35}
                  fill="url(#center-gradient)"
                />
                <path
                  d={hexagonPath(nodes[0].x, nodes[0].y, 24)}
                  fill="hsl(225, 30%, 5%)"
                  stroke="hsl(185, 100%, 50%)"
                  strokeWidth={2}
                />
                <text
                  x={nodes[0].x}
                  y={nodes[0].y + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="hsl(185, 100%, 50%)"
                  fontSize="8"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  NODE
                </text>
              </g>
            )}

            {nodes.filter(n => !n.isCenter).map((node) => {
              const color = getLatencyColor(node.peer?.latency);
              const isHovered = node.id === hoveredNode;
              const radius = isHovered ? 14 : 10;
              return (
                <g key={`node-${node.id}`} filter={isHovered ? "url(#glow-node)" : undefined}>
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={radius}
                    fill="hsl(225, 30%, 5%)"
                    stroke={color}
                    strokeWidth={isHovered ? 2 : 1.5}
                    style={{ cursor: "pointer" }}
                  />
                  {node.peer?.inbound ? (
                    <path
                      d={`M${node.x - 3} ${node.y + 2}L${node.x} ${node.y - 3}L${node.x + 3} ${node.y + 2}`}
                      fill="none"
                      stroke={color}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ pointerEvents: "none" }}
                    />
                  ) : (
                    <path
                      d={`M${node.x - 3} ${node.y - 2}L${node.x} ${node.y + 3}L${node.x + 3} ${node.y - 2}`}
                      fill="none"
                      stroke={color}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ pointerEvents: "none" }}
                    />
                  )}
                </g>
              );
            })}
          </svg>

          {hoveredNode && hoveredPeer && (
            <div
              className="absolute pointer-events-none z-50"
              style={{
                left: tooltipPos.x + 16,
                top: tooltipPos.y - 10,
                maxWidth: 280,
              }}
              data-testid="tooltip-peer-details"
            >
              <Card className="cyber-border cyber-glow p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getLatencyColor(hoveredPeer.latency) }}
                  />
                  <span className="text-xs font-mono text-primary">
                    {maskAddress(hoveredPeer.address)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <span className="text-muted-foreground">Direction</span>
                  <span className="font-mono">{hoveredPeer.inbound ? "Inbound" : "Outbound"}</span>
                  <span className="text-muted-foreground">Latency</span>
                  <span className="font-mono" style={{ color: getLatencyColor(hoveredPeer.latency) }}>
                    {hoveredPeer.latency ? `${hoveredPeer.latency}ms (${getLatencyLabel(hoveredPeer.latency)})` : "N/A"}
                  </span>
                  <span className="text-muted-foreground">Version</span>
                  <span className="font-mono truncate">{hoveredPeer.version || "N/A"}</span>
                  <span className="text-muted-foreground">Uptime</span>
                  <span className="font-mono">{formatUptime(hoveredPeer.uptime)}</span>
                  <span className="text-muted-foreground">Ledgers</span>
                  <span className="font-mono truncate">{hoveredPeer.completeLedgers || "N/A"}</span>
                </div>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

/** Donut chart showing the distribution of rippled versions across peers. */
function VersionDistribution({ peers }: { peers: PeerInfo[] }) {
  const versionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    peers.forEach(p => {
      const v = p.version || "Unknown";
      const shortVersion = v.replace("rippled-", "").split("+")[0];
      counts[shortVersion] = (counts[shortVersion] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [peers]);

  const total = peers.length;
  const colors = [
    "hsl(185, 100%, 50%)",
    "hsl(270, 80%, 65%)",
    "hsl(330, 90%, 60%)",
    "hsl(120, 80%, 55%)",
    "hsl(40, 95%, 55%)",
    "hsl(200, 85%, 60%)",
    "hsl(300, 70%, 55%)",
    "hsl(160, 80%, 50%)",
  ];

  const donutSize = 160;
  const outerR = 65;
  const innerR = 40;
  const cx = donutSize / 2;
  const cy = donutSize / 2;

  let startAngle = -Math.PI / 2;
  const arcs = versionCounts.map(([version, count], i) => {
    const sliceAngle = (count / total) * Math.PI * 2;
    const endAngle = startAngle + sliceAngle;
    const largeArc = sliceAngle > Math.PI ? 1 : 0;

    const x1Outer = cx + outerR * Math.cos(startAngle);
    const y1Outer = cy + outerR * Math.sin(startAngle);
    const x2Outer = cx + outerR * Math.cos(endAngle);
    const y2Outer = cy + outerR * Math.sin(endAngle);
    const x1Inner = cx + innerR * Math.cos(endAngle);
    const y1Inner = cy + innerR * Math.sin(endAngle);
    const x2Inner = cx + innerR * Math.cos(startAngle);
    const y2Inner = cy + innerR * Math.sin(startAngle);

    const path = `M${x1Outer},${y1Outer} A${outerR},${outerR} 0 ${largeArc} 1 ${x2Outer},${y2Outer} L${x1Inner},${y1Inner} A${innerR},${innerR} 0 ${largeArc} 0 ${x2Inner},${y2Inner} Z`;

    startAngle = endAngle;
    return { path, color: colors[i % colors.length], version, count, percent: ((count / total) * 100).toFixed(0) };
  });

  return (
    <motion.div variants={itemVariants}>
      <Card className="cyber-border relative overflow-visible">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium tracking-wide uppercase">Version Distribution</CardTitle>
          <Globe className="w-4 h-4 text-primary/60" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <svg width={donutSize} height={donutSize} viewBox={`0 0 ${donutSize} ${donutSize}`} data-testid="svg-version-chart">
              <defs>
                <filter id="donut-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <g filter="url(#donut-glow)">
                {arcs.map((arc, i) => (
                  <path
                    key={i}
                    d={arc.path}
                    fill={arc.color}
                    fillOpacity="0.85"
                    stroke="hsl(225, 30%, 3%)"
                    strokeWidth="1"
                  />
                ))}
              </g>
              <text
                x={cx}
                y={cy - 6}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="hsl(185, 100%, 50%)"
                fontSize="18"
                fontFamily="monospace"
                fontWeight="bold"
              >
                {total}
              </text>
              <text
                x={cx}
                y={cy + 10}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="hsl(210, 15%, 55%)"
                fontSize="8"
                fontFamily="monospace"
              >
                PEERS
              </text>
            </svg>

            <div className="flex-1 space-y-1.5 min-w-0">
              {arcs.map((arc, i) => (
                <div key={i} className="flex items-center gap-2" data-testid={`version-entry-${i}`}>
                  <span
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: arc.color }}
                  />
                  <span className="text-xs font-mono truncate flex-1 text-muted-foreground">{arc.version}</span>
                  <span className="text-xs font-mono text-foreground">{arc.count}</span>
                  <span className="text-xs font-mono text-muted-foreground w-8 text-right">{arc.percent}%</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function PeerTable({ peers }: { peers: PeerInfo[] }) {
  return (
    <motion.div variants={itemVariants}>
      <Card className="cyber-border relative overflow-visible">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium tracking-wide uppercase">Connected Peers</CardTitle>
          <Globe className="w-4 h-4 text-primary/60" />
        </CardHeader>
        <CardContent>
          <div className="overflow-auto max-h-[500px]">
            <Table data-testid="table-peers">
              <TableHeader>
                <TableRow className="border-primary/10">
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Address</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Direction</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Version</TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground">Latency</TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground">Uptime</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Ledgers</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {peers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8 font-mono">
                      No peers connected
                    </TableCell>
                  </TableRow>
                ) : (
                  peers.map((peer, index) => (
                    <TableRow
                      key={peer.publicKey || index}
                      className="border-primary/5 transition-colors duration-200"
                      style={{ animationDelay: `${index * 30}ms` }}
                      data-testid={`row-peer-${index}`}
                    >
                      <TableCell className="font-mono text-xs text-primary/70">
                        {maskAddress(peer.address)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={peer.inbound ? "secondary" : "default"}
                          className={`no-default-active-elevate ${!peer.inbound ? "shadow-glow-sm" : ""}`}
                          data-testid={`badge-direction-${index}`}
                        >
                          {peer.inbound ? (
                            <ArrowDownLeft className="w-3 h-3 mr-1" />
                          ) : (
                            <ArrowUpRight className="w-3 h-3 mr-1" />
                          )}
                          {peer.inbound ? "In" : "Out"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {peer.version || "N/A"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        <span className={peer.latency && peer.latency > 100 ? "text-destructive" : "text-primary/70"}>
                          {peer.latency ? `${peer.latency}ms` : "N/A"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        <div className="flex items-center justify-end gap-1">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span className="font-mono">{formatUptime(peer.uptime)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate font-mono">
                        {peer.completeLedgers || "N/A"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface PeerLocation {
  ip: string;
  lat: number;
  lon: number;
  country: string;
  city: string;
  count: number;
}

interface PeerLocationsResponse {
  locations: PeerLocation[];
  totalPeers: number;
  geolocated: number;
}

function projectLatLon(lat: number, lon: number, width: number, height: number): { x: number; y: number } {
  const x = ((lon + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return { x, y };
}

function DetailedWorldMap({ width, height }: { width: number; height: number }) {
  const continentPaths = useMemo(() => {
    const p = (lat: number, lon: number) => projectLatLon(lat, lon, width, height);
    const pts2str = (coords: [number, number][]) => {
      const mapped = coords.map(([lat, lon]) => p(lat, lon));
      return `M${mapped.map(pt => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(" L")}Z`;
    };

    const northAmerica = pts2str([
      [83,-70],[82,-80],[80,-95],[78,-105],[75,-120],[72,-128],[70,-141],[69,-139],
      [67,-140],[65,-141],[63,-145],[61,-147],[60,-149],[59,-152],[58,-153],[57,-157],
      [56,-160],[55,-163],[54,-165],[53,-167],[55,-170],[58,-170],[60,-167],[62,-163],
      [64,-162],[66,-164],[68,-163],[70,-162],[71,-157],[72,-155],[71,-151],[70,-146],
      [69,-141],[68,-138],[66,-136],[64,-133],[63,-131],[62,-129],[61,-130],[60,-132],
      [60,-137],[59,-138],[58,-136],[57,-133],[56,-131],[55,-130],[54,-129],[53,-128],
      [52,-128],[51,-128],[50,-127],[49,-126],[48,-125],[47,-124],[46,-124],[44,-124],
      [42,-124],[40,-124],[38,-123],[37,-122],[35,-121],[34,-120],[33,-118],[32,-117],
      [31,-116],[30,-115],[29,-114],[28,-112],[27,-110],[26,-109],[25,-108],[24,-107],
      [23,-106],[22,-105],[21,-105],[20,-105],[19,-104],[18,-103],[17,-101],[16,-97],
      [16,-93],[15,-92],[16,-90],[17,-89],[18,-88],[19,-87],[20,-87],[21,-87],
      [22,-86],[21,-88],[20,-90],[19,-91],[18,-91],[17,-92],[18,-89],[19,-88],
      [20,-87],[21,-86],[22,-85],[23,-83],[24,-82],[25,-81],[26,-80],[27,-80],
      [28,-80],[29,-81],[30,-81],[31,-82],[32,-81],[33,-80],[34,-78],[35,-76],
      [36,-76],[37,-76],[38,-75],[39,-75],[40,-74],[41,-73],[42,-71],[43,-70],
      [44,-69],[45,-67],[46,-64],[47,-62],[48,-60],[49,-59],[50,-57],[51,-56],
      [52,-56],[53,-56],[54,-58],[55,-60],[56,-62],[57,-63],[58,-64],[59,-64],
      [60,-65],[61,-65],[62,-66],[63,-68],[64,-67],[65,-64],[66,-62],[67,-60],
      [68,-58],[69,-55],[70,-55],[71,-56],[72,-58],[73,-60],[74,-62],[75,-65],
      [76,-70],[77,-73],[78,-75],[79,-76],[80,-78],[81,-75],[82,-72],[83,-70]
    ]);

    const centralAmerica = pts2str([
      [18,-88],[17,-89],[16,-90],[15,-89],[14,-88],[13,-88],[12,-86],[11,-85],
      [10,-84],[9,-83],[9,-82],[9,-80],[8,-79],[8,-78],[8,-77],[9,-76],
      [10,-76],[11,-75],[12,-72],[11,-74],[10,-76],[9,-78],[9,-79],[10,-81],
      [11,-83],[12,-84],[13,-86],[14,-87],[15,-88],[16,-89],[17,-89],[18,-88]
    ]);

    const southAmerica = pts2str([
      [12,-72],[11,-73],[10,-72],[9,-71],[8,-70],[7,-68],[6,-66],[5,-62],
      [4,-60],[3,-58],[2,-55],[1,-52],[0,-50],[-1,-48],[-2,-44],[-3,-42],
      [-4,-39],[-5,-36],[-6,-35],[-7,-35],[-8,-35],[-9,-35],[-10,-36],
      [-11,-37],[-12,-38],[-13,-39],[-14,-39],[-15,-39],[-16,-40],[-17,-40],
      [-18,-40],[-19,-40],[-20,-41],[-21,-41],[-22,-41],[-23,-42],[-24,-44],
      [-25,-46],[-26,-48],[-27,-49],[-28,-49],[-29,-50],[-30,-51],[-31,-52],
      [-32,-53],[-33,-54],[-34,-55],[-35,-57],[-36,-57],[-37,-58],[-38,-58],
      [-39,-62],[-40,-62],[-41,-63],[-42,-64],[-43,-65],[-44,-66],[-45,-66],
      [-46,-66],[-47,-66],[-48,-66],[-49,-68],[-50,-69],[-51,-70],[-52,-71],
      [-53,-72],[-54,-72],[-55,-69],[-54,-67],[-53,-68],[-52,-70],[-51,-69],
      [-50,-68],[-49,-66],[-48,-65],[-47,-66],[-46,-68],[-45,-72],[-44,-72],
      [-43,-73],[-42,-73],[-41,-73],[-40,-73],[-39,-72],[-38,-72],[-37,-72],
      [-36,-72],[-35,-72],[-34,-72],[-33,-72],[-32,-71],[-31,-72],[-30,-72],
      [-29,-71],[-28,-71],[-27,-71],[-26,-70],[-25,-70],[-24,-70],[-23,-70],
      [-22,-70],[-21,-70],[-20,-70],[-19,-70],[-18,-70],[-17,-72],[-16,-75],
      [-15,-76],[-14,-76],[-13,-77],[-12,-77],[-11,-78],[-10,-78],[-9,-79],
      [-8,-80],[-7,-80],[-6,-80],[-5,-80],[-4,-80],[-3,-80],[-2,-80],[-1,-80],
      [0,-80],[1,-79],[2,-78],[3,-78],[4,-77],[5,-77],[6,-76],[7,-76],
      [8,-74],[9,-73],[10,-73],[11,-73],[12,-72]
    ]);

    const europe = pts2str([
      [71,-25],[70,-22],[69,-18],[68,-15],[67,-14],[66,-13],[65,-12],
      [64,-14],[63,-16],[62,-18],[61,-20],[60,-20],[59,-18],[58,-16],
      [57,-13],[56,-10],[55,-8],[54,-8],[53,-6],[52,-5],[51,-5],[50,-5],
      [49,-4],[48,-5],[47,-3],[46,-2],[44,-1],[43,-2],[42,-3],[41,-5],
      [40,-5],[39,-6],[38,-5],[37,-6],[36,-6],[36,-5],[37,-2],[38,0],
      [39,0],[40,0],[41,1],[42,3],[43,5],[44,8],[44,10],[45,12],
      [44,12],[43,13],[42,15],[41,15],[40,16],[39,18],[38,20],[37,22],
      [36,23],[35,24],[35,26],[36,27],[37,28],[38,28],[39,27],[40,26],
      [41,27],[42,28],[42,29],[43,28],[44,28],[45,29],[46,30],[47,30],
      [48,28],[49,26],[50,24],[51,22],[52,21],[53,18],[54,18],[55,20],
      [56,18],[57,16],[58,15],[59,16],[60,18],[61,20],[62,20],[63,22],
      [64,24],[65,25],[66,25],[67,26],[68,27],[69,28],[70,30],
      [71,29],[72,28],[73,26],[73,22],[72,18],[72,14],[71,10],
      [71,5],[71,0],[71,-5],[71,-10],[71,-15],[71,-20],[71,-25]
    ]);

    const uk = pts2str([
      [58,-5],[57,-6],[56,-6],[55,-5],[54,-4],[53,-4],[52,-4],[51,-3],
      [50,-5],[50,-4],[51,-1],[52,0],[53,1],[53,0],[54,-1],[55,-2],
      [56,-3],[57,-5],[58,-5]
    ]);

    const iceland = pts2str([
      [66,-18],[65,-20],[64,-22],[63,-22],[63,-20],[64,-18],[65,-16],
      [65,-14],[66,-14],[66,-16],[66,-18]
    ]);

    const africa = pts2str([
      [37,-10],[36,-8],[35,-5],[34,-2],[33,0],[32,0],[31,2],[30,5],
      [29,8],[28,10],[30,10],[31,12],[32,15],[33,12],[34,10],[35,10],
      [35,12],[34,15],[33,18],[32,20],[31,22],[30,25],[31,28],[32,32],
      [31,33],[30,33],[29,33],[28,34],[27,34],[26,35],[24,36],[22,37],
      [20,38],[18,40],[16,42],[14,44],[12,45],[11,47],[10,50],[8,48],
      [6,44],[5,42],[4,42],[3,41],[2,42],[1,41],[0,42],[-1,42],
      [-2,41],[-3,40],[-4,40],[-5,40],[-6,39],[-8,39],[-10,40],
      [-12,40],[-14,38],[-16,37],[-18,36],[-20,35],[-22,35],[-24,35],
      [-26,33],[-28,30],[-30,31],[-32,29],[-34,27],[-34,25],[-34,22],
      [-34,20],[-33,18],[-32,18],[-30,17],[-28,16],[-26,15],[-24,14],
      [-22,14],[-20,13],[-18,12],[-16,12],[-14,12],[-12,13],[-10,14],
      [-8,14],[-6,12],[-5,10],[-4,10],[-3,10],[-2,10],[-1,10],
      [0,10],[1,8],[2,5],[3,3],[4,2],[5,1],[6,1],[7,1],[8,-1],
      [9,-3],[10,-5],[11,-8],[12,-10],[13,-12],[14,-14],[15,-16],
      [17,-16],[18,-16],[20,-17],[22,-17],[24,-16],[26,-15],[28,-14],
      [30,-12],[32,-10],[34,-8],[36,-6],[37,-10]
    ]);

    const madagascar = pts2str([
      [-12,49],[-14,48],[-16,47],[-18,45],[-20,44],[-22,44],[-24,44],
      [-25,47],[-24,48],[-22,48],[-20,49],[-18,50],[-16,50],[-14,50],[-12,49]
    ]);

    const middleEast = pts2str([
      [37,36],[36,36],[35,36],[34,36],[33,36],[32,35],[31,35],[30,34],
      [29,34],[28,34],[27,35],[26,36],[25,37],[24,38],[23,38],[22,39],
      [21,40],[20,41],[18,42],[16,43],[14,44],[13,45],[12,44],[13,48],
      [14,49],[15,50],[16,52],[18,55],[20,57],[22,58],[24,58],[25,56],
      [26,56],[27,56],[28,55],[29,52],[30,50],[30,48],[31,47],[32,48],
      [33,49],[34,48],[35,46],[36,44],[36,42],[37,40],[37,38],[37,36]
    ]);

    const asia = pts2str([
      [72,30],[72,35],[72,40],[72,50],[72,60],[72,70],[72,80],[72,90],
      [72,100],[72,110],[72,120],[72,130],[72,140],[72,150],[72,160],
      [72,170],[72,178],[70,178],[68,175],[66,170],[65,168],[64,165],
      [63,162],[62,163],[61,161],[60,160],[59,158],[58,155],[57,153],
      [56,156],[55,158],[54,156],[53,153],[52,150],[51,148],[50,143],
      [48,144],[46,143],[45,142],[44,143],[43,145],[42,140],[41,135],
      [40,132],[39,128],[38,126],[37,127],[36,126],[35,128],[34,130],
      [33,131],[32,132],[31,131],[30,122],[29,120],[28,117],[27,115],
      [26,112],[25,110],[24,108],[23,107],[22,106],[21,106],[20,106],
      [19,106],[18,106],[17,105],[16,104],[15,103],[14,102],[13,101],
      [12,100],[11,99],[10,99],[9,100],[8,99],[7,98],[6,96],[5,95],
      [4,95],[3,96],[2,96],[1,96],[0,96],[-1,97],[-2,98],[-3,99],
      [-4,100],[-5,101],[-6,102],[-7,103],[-8,106],[-7,108],[-6,110],
      [-5,112],[-6,114],[-7,115],[-8,116],[-8,114],[-7,112],[-7,110],
      [-6,108],[-8,110],[-8,112],[-7,114],[-6,116],[-4,118],
      [-2,116],[0,114],[1,112],[2,110],[3,108],[4,107],
      [5,105],[6,103],[7,101],[8,100],[9,100],[10,101],[11,103],
      [12,103],[13,105],[14,108],[15,108],[16,108],[18,107],
      [19,106],[20,106],[21,107],[22,108],[23,110],[24,112],
      [25,115],[26,117],[27,119],[28,121],[29,122],[30,121],
      [30,118],[29,116],[28,114],[27,110],[26,107],[25,105],
      [24,103],[23,100],[22,98],[21,96],[20,94],[19,92],[18,88],
      [17,85],[16,82],[15,80],[14,78],[13,77],[12,75],[11,74],
      [10,76],[9,77],[8,77],[7,78],[6,80],[5,80],[6,78],[7,76],
      [8,75],[9,74],[10,73],[11,72],[12,70],[13,68],[14,66],
      [15,68],[16,72],[17,74],[18,76],[19,78],[20,73],[21,72],
      [22,70],[23,68],[24,67],[25,65],[26,63],[27,62],[28,60],
      [29,58],[30,53],[31,50],[32,48],[33,49],[34,48],[35,46],
      [36,44],[37,40],[38,38],[39,36],[40,35],[41,33],[42,32],
      [43,31],[44,30],[45,31],[46,32],[48,34],[50,36],[52,38],
      [54,40],[55,44],[56,48],[57,50],[58,52],[59,54],[60,56],
      [61,58],[62,60],[63,62],[64,64],[65,66],[66,68],[67,70],
      [68,68],[69,65],[70,60],[70,55],[70,50],[70,45],[70,40],
      [71,35],[72,30]
    ]);

    const japan = pts2str([
      [45,142],[44,144],[43,145],[42,143],[41,141],[40,140],[39,140],
      [38,139],[37,137],[36,136],[35,135],[34,133],[33,132],[32,131],
      [31,131],[32,132],[33,134],[34,135],[35,136],[36,138],[37,140],
      [38,140],[39,141],[40,141],[41,142],[42,143],[43,145],[44,145],[45,142]
    ]);

    const australia = pts2str([
      [-11,132],[-12,131],[-13,130],[-14,128],[-15,127],[-16,126],
      [-18,123],[-20,119],[-22,117],[-24,114],[-26,114],[-28,114],
      [-30,115],[-32,116],[-34,116],[-35,117],[-36,118],[-37,120],
      [-38,123],[-38,126],[-38,130],[-38,135],[-38,140],[-38,144],
      [-38,147],[-37,149],[-36,150],[-35,151],[-34,151],[-33,152],
      [-32,152],[-30,153],[-28,153],[-26,153],[-24,152],[-22,150],
      [-20,149],[-18,147],[-16,146],[-15,145],[-14,144],[-13,142],
      [-12,141],[-12,137],[-12,136],[-12,135],[-11,134],[-11,132]
    ]);

    const newZealand = pts2str([
      [-35,174],[-36,175],[-37,176],[-38,177],[-39,177],[-40,176],
      [-41,175],[-42,173],[-43,172],[-44,170],[-45,168],[-46,167],
      [-46,168],[-45,170],[-44,171],[-43,173],[-42,174],[-41,175],
      [-40,176],[-39,177],[-38,178],[-37,177],[-36,176],[-35,174]
    ]);

    const indonesia = pts2str([
      [-2,106],[-3,107],[-4,108],[-5,109],[-6,110],[-7,111],[-8,112],
      [-8,114],[-8,116],[-7,117],[-6,116],[-5,115],[-4,114],[-3,112],
      [-2,110],[-1,108],[-2,106]
    ]);

    const borneo = pts2str([
      [7,117],[6,116],[5,115],[4,115],[3,114],[2,112],[1,110],
      [0,109],[-1,109],[-2,110],[-3,112],[-2,114],[-1,115],[0,116],
      [1,117],[2,118],[3,118],[4,118],[5,118],[6,118],[7,117]
    ]);

    const greenland = pts2str([
      [84,-30],[83,-28],[82,-25],[81,-22],[80,-20],[79,-19],[78,-18],
      [77,-18],[76,-20],[75,-21],[74,-22],[73,-23],[72,-24],[71,-25],
      [70,-26],[69,-28],[68,-30],[67,-32],[66,-35],[65,-38],[64,-42],
      [63,-45],[62,-48],[61,-50],[60,-50],[61,-48],[62,-45],[63,-42],
      [64,-40],[65,-38],[66,-38],[67,-38],[68,-36],[69,-34],[70,-32],
      [71,-30],[72,-28],[73,-26],[74,-24],[75,-22],[76,-22],[77,-21],
      [78,-22],[79,-24],[80,-26],[81,-28],[82,-30],[83,-35],[84,-38],
      [84,-42],[84,-46],[83,-48],[82,-50],[81,-52],[80,-54],[79,-58],
      [78,-60],[77,-62],[76,-64],[75,-62],[76,-58],[77,-55],[78,-52],
      [79,-50],[80,-48],[81,-46],[82,-44],[83,-40],[84,-36],[84,-30]
    ]);

    const svalbard = pts2str([
      [80,15],[79,12],[78,11],[77,14],[77,16],[78,18],[79,20],[80,20],
      [80,18],[80,15]
    ]);

    const philippines = pts2str([
      [19,121],[18,120],[16,120],[14,121],[13,122],[12,123],[11,124],
      [10,124],[11,125],[12,125],[13,124],[14,123],[16,122],[18,122],[19,121]
    ]);

    const sriLanka = pts2str([
      [10,80],[9,80],[8,80],[7,80],[6,81],[7,82],[8,82],[9,81],[10,80]
    ]);

    const taiwan = pts2str([
      [25,121],[24,120],[23,120],[22,121],[23,122],[24,122],[25,121]
    ]);

    return [
      { d: northAmerica, fill: "hsl(185, 25%, 13%)" },
      { d: centralAmerica, fill: "hsl(185, 25%, 13%)" },
      { d: southAmerica, fill: "hsl(185, 25%, 12%)" },
      { d: europe, fill: "hsl(185, 25%, 14%)" },
      { d: uk, fill: "hsl(185, 25%, 14%)" },
      { d: iceland, fill: "hsl(185, 25%, 14%)" },
      { d: africa, fill: "hsl(185, 25%, 11%)" },
      { d: madagascar, fill: "hsl(185, 25%, 11%)" },
      { d: middleEast, fill: "hsl(185, 25%, 12%)" },
      { d: asia, fill: "hsl(185, 25%, 13%)" },
      { d: japan, fill: "hsl(185, 25%, 14%)" },
      { d: australia, fill: "hsl(185, 25%, 12%)" },
      { d: newZealand, fill: "hsl(185, 25%, 12%)" },
      { d: indonesia, fill: "hsl(185, 25%, 12%)" },
      { d: borneo, fill: "hsl(185, 25%, 12%)" },
      { d: greenland, fill: "hsl(185, 25%, 15%)" },
      { d: svalbard, fill: "hsl(185, 25%, 14%)" },
      { d: philippines, fill: "hsl(185, 25%, 13%)" },
      { d: sriLanka, fill: "hsl(185, 25%, 13%)" },
      { d: taiwan, fill: "hsl(185, 25%, 13%)" },
    ];
  }, [width, height]);

  return (
    <g>
      {continentPaths.map((item, i) => (
        <path
          key={i}
          d={item.d}
          fill={item.fill}
          stroke="hsl(185, 100%, 50%)"
          strokeWidth="0.7"
          strokeOpacity="0.35"
          fillOpacity="0.7"
        />
      ))}
    </g>
  );
}

function PeerDetailPanel({ peer, onClose }: { peer: PeerLocation | null; onClose: () => void }) {
  if (!peer) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <Sheet open={!!peer} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="cyber-border border-l-primary/30 bg-background/95 backdrop-blur-md overflow-auto" data-testid="panel-peer-detail">
        <SheetHeader className="pb-4 border-b border-primary/10">
          <SheetTitle className="flex items-center gap-2 text-primary text-glow font-mono">
            <MapPin className="w-5 h-5" />
            Peer Details
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-5 pt-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-md bg-primary/10 cyber-border">
              <Globe className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-lg font-semibold font-mono text-primary text-glow" data-testid="text-peer-location">
                {peer.city}, {peer.country}
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                {peer.count} peer{peer.count !== 1 ? "s" : ""} at this location
              </p>
            </div>
          </div>

          <Card className="cyber-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Server className="w-3.5 h-3.5" />
                Network Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">IP Address</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-mono text-primary" data-testid="text-peer-ip">{peer.ip}</span>
                  <button
                    onClick={() => copyToClipboard(peer.ip)}
                    className="p-1 rounded hover:bg-primary/10 transition-colors"
                    data-testid="button-copy-ip"
                  >
                    <Copy className="w-3 h-3 text-muted-foreground" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Peer Count</span>
                <Badge variant="secondary" className="font-mono" data-testid="text-peer-count">{peer.count}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="cyber-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5" />
                Coordinates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Latitude</span>
                <span className="text-sm font-mono" data-testid="text-peer-lat">{peer.lat.toFixed(4)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Longitude</span>
                <span className="text-sm font-mono" data-testid="text-peer-lon">{peer.lon.toFixed(4)}</span>
              </div>
            </CardContent>
          </Card>

          <div className="pt-2">
            <a
              href={`https://www.google.com/maps/@${peer.lat},${peer.lon},8z`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-primary/70 hover:text-primary transition-colors font-mono"
              data-testid="link-google-maps"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View on Google Maps
            </a>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PeerGeoMap() {
  const { data, isLoading } = useQuery<PeerLocationsResponse>({
    queryKey: ["/api/node/peer-locations"],
    refetchInterval: 30000,
  });

  const [hoveredPeer, setHoveredPeer] = useState<PeerLocation | null>(null);
  const [selectedPeer, setSelectedPeer] = useState<PeerLocation | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  const mapWidth = 900;
  const mapHeight = 500;

  const topCountries = useMemo(() => {
    if (!data?.locations) return [];
    const countryMap: Record<string, number> = {};
    data.locations.forEach(loc => {
      countryMap[loc.country] = (countryMap[loc.country] || 0) + loc.count;
    });
    return Object.entries(countryMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [data]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = mapWidth / rect.width;
    const scaleY = mapHeight / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    let found: PeerLocation | null = null;
    if (data?.locations) {
      for (const loc of data.locations) {
        const { x, y } = projectLatLon(loc.lat, loc.lon, mapWidth, mapHeight);
        const dx = mx - x;
        const dy = my - y;
        if (Math.sqrt(dx * dx + dy * dy) < 14) {
          found = loc;
          setTooltipPos({ x: e.clientX - (svg.getBoundingClientRect().left), y: e.clientY - (svg.getBoundingClientRect().top) });
          break;
        }
      }
    }
    setHoveredPeer(found);
  }, [data]);

  const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = mapWidth / rect.width;
    const scaleY = mapHeight / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    if (data?.locations) {
      for (const loc of data.locations) {
        const { x, y } = projectLatLon(loc.lat, loc.lon, mapWidth, mapHeight);
        const dx = mx - x;
        const dy = my - y;
        if (Math.sqrt(dx * dx + dy * dy) < 14) {
          setSelectedPeer(loc);
          return;
        }
      }
    }
  }, [data]);

  if (isLoading) {
    return (
      <motion.div variants={itemVariants}>
        <Card className="cyber-border relative overflow-visible">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
          <CardContent className="py-8">
            <Skeleton className="h-[400px] w-full cyber-glow" />
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  const locations = data?.locations || [];

  return (
    <motion.div variants={itemVariants} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="cyber-border relative overflow-visible">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
          <CardContent className="flex items-center gap-3 py-4">
            <div className="p-2 rounded-md bg-primary/10 cyber-border">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Peers</p>
              <p className="text-2xl font-semibold font-mono text-primary text-glow" data-testid="text-map-total-peers">
                {data?.totalPeers || 0}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="cyber-border relative overflow-visible">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
          <CardContent className="flex items-center gap-3 py-4">
            <div className="p-2 rounded-md bg-primary/10 cyber-border">
              <MapPin className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Geolocated</p>
              <p className="text-2xl font-semibold font-mono text-primary text-glow" data-testid="text-map-geolocated">
                {data?.geolocated || 0}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="cyber-border relative overflow-visible">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
          <CardContent className="flex items-center gap-3 py-4">
            <div className="p-2 rounded-md bg-primary/10 cyber-border">
              <Globe className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Countries</p>
              <p className="text-2xl font-semibold font-mono text-primary text-glow" data-testid="text-map-countries">
                {topCountries.length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="cyber-border relative overflow-visible">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium tracking-wide uppercase">Peer Geolocation Map</CardTitle>
          <Globe className="w-4 h-4 text-primary/60" />
        </CardHeader>
        <CardContent className="relative">
          <svg
            ref={svgRef}
            width={mapWidth}
            height={mapHeight}
            className="w-full rounded-lg"
            viewBox={`0 0 ${mapWidth} ${mapHeight}`}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredPeer(null)}
            onClick={handleClick}
            data-testid="svg-peer-map"
            style={{ background: "linear-gradient(180deg, hsl(225, 30%, 4%) 0%, hsl(225, 30%, 2%) 100%)" }}
          >
            <defs>
              <filter id="peer-glow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="peer-pulse" x="-200%" y="-200%" width="500%" height="500%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <radialGradient id="peer-dot-gradient" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="hsl(185, 100%, 70%)" stopOpacity="1" />
                <stop offset="70%" stopColor="hsl(185, 100%, 55%)" stopOpacity="0.8" />
                <stop offset="100%" stopColor="hsl(185, 100%, 50%)" stopOpacity="0.3" />
              </radialGradient>
            </defs>

            {Array.from({ length: 7 }).map((_, i) => (
              <line
                key={`grid-h-${i}`}
                x1={0}
                y1={(i * mapHeight) / 6}
                x2={mapWidth}
                y2={(i * mapHeight) / 6}
                stroke="hsl(185, 100%, 50%)"
                strokeOpacity="0.03"
                strokeDasharray="2 6"
              />
            ))}
            {Array.from({ length: 13 }).map((_, i) => (
              <line
                key={`grid-v-${i}`}
                x1={(i * mapWidth) / 12}
                y1={0}
                x2={(i * mapWidth) / 12}
                y2={mapHeight}
                stroke="hsl(185, 100%, 50%)"
                strokeOpacity="0.03"
                strokeDasharray="2 6"
              />
            ))}

            <DetailedWorldMap width={mapWidth} height={mapHeight} />

            {locations.map((loc, i) => {
              const { x, y } = projectLatLon(loc.lat, loc.lon, mapWidth, mapHeight);
              const isHovered = hoveredPeer?.ip === loc.ip;
              const isSelected = selectedPeer?.ip === loc.ip;
              const dotRadius = Math.max(3.5, Math.min(9, 2.5 + loc.count * 1.5));
              const active = isHovered || isSelected;
              return (
                <g key={`peer-${i}`} style={{ cursor: "pointer" }}>
                  <circle
                    cx={x}
                    cy={y}
                    r={active ? dotRadius + 10 : dotRadius + 4}
                    fill="hsl(185, 100%, 50%)"
                    fillOpacity={active ? 0.12 : 0.05}
                    filter="url(#peer-pulse)"
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={active ? dotRadius + 2 : dotRadius}
                    fill="url(#peer-dot-gradient)"
                    stroke="hsl(185, 100%, 65%)"
                    strokeWidth={active ? 2 : 0.8}
                    data-testid={`dot-peer-${i}`}
                  />
                  {active && (
                    <text
                      x={x}
                      y={y - dotRadius - 8}
                      textAnchor="middle"
                      fill="hsl(185, 100%, 70%)"
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {loc.city}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          <p className="text-[10px] text-muted-foreground/50 text-center font-mono mt-1">
            Click on a peer dot to view details
          </p>

          {hoveredPeer && (
            <div
              className="absolute pointer-events-none z-50"
              style={{
                left: Math.min(tooltipPos.x + 16, mapWidth * 0.7),
                top: tooltipPos.y - 10,
                maxWidth: 280,
              }}
              data-testid="tooltip-map-peer"
            >
              <Card className="cyber-border cyber-glow p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3 h-3 text-primary" />
                  <span className="text-xs font-mono text-primary font-semibold">
                    {hoveredPeer.city}, {hoveredPeer.country}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <span className="text-muted-foreground">IP</span>
                  <span className="font-mono">{hoveredPeer.ip}</span>
                  <span className="text-muted-foreground">Coords</span>
                  <span className="font-mono">{hoveredPeer.lat.toFixed(2)}, {hoveredPeer.lon.toFixed(2)}</span>
                  <span className="text-muted-foreground">Peers</span>
                  <span className="font-mono text-primary">{hoveredPeer.count}</span>
                </div>
                <p className="text-[10px] text-muted-foreground/60 pt-1">Click to view full details</p>
              </Card>
            </div>
          )}

          <PeerDetailPanel peer={selectedPeer} onClose={() => setSelectedPeer(null)} />
        </CardContent>
      </Card>

      {topCountries.length > 0 && (
        <Card className="cyber-border relative overflow-visible">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium tracking-wide uppercase">Top Countries</CardTitle>
            <Globe className="w-4 h-4 text-primary/60" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topCountries.map(([country, count], i) => {
                const maxCount = topCountries[0][1] as number;
                const pct = ((count as number) / maxCount) * 100;
                return (
                  <div key={country} className="flex items-center gap-3" data-testid={`country-entry-${i}`}>
                    <span className="text-xs font-mono text-muted-foreground w-24 truncate">{country}</span>
                    <div className="flex-1 h-2 rounded-full bg-primary/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/60"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-primary w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}

function PeersSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Skeleton className="h-8 w-32 cyber-glow" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Skeleton className="h-20 cyber-glow" />
        <Skeleton className="h-20 cyber-glow" />
        <Skeleton className="h-20 cyber-glow" />
      </div>
      <Skeleton className="h-96 cyber-glow" />
    </div>
  );
}

export default function PeersPage() {
  const { data, isLoading, isError } = useQuery<PeersResponse>({
    queryKey: ["/api/node/peers"],
    refetchInterval: 5000,
  });

  if (isLoading) return <PeersSkeleton />;

  const peers = data?.data;
  const isDisconnected = !peers || data?.status === "disconnected";

  if (isError || isDisconnected) {
    return (
      <div className="p-6 space-y-6 overflow-auto h-full">
        <div className="flex items-center gap-3 flex-wrap">
          <Users className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-semibold uppercase tracking-widest text-glow">Peer Network</h1>
        </div>
        <div className="neon-line" />
        <Card className="cyber-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="w-12 h-12 text-primary/30 mb-4" />
            <p className="text-muted-foreground text-center font-mono" data-testid="text-peers-error">
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
        <Users className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-semibold uppercase tracking-widest text-glow" data-testid="text-page-title">
          Peer Network
        </h1>
      </motion.div>

      <motion.div variants={itemVariants}>
        <div className="neon-line" />
      </motion.div>

      <PeerSummary peers={peers} />

      <motion.div variants={itemVariants}>
        <Tabs defaultValue="map" data-testid="tabs-peer-view">
          <TabsList data-testid="tabslist-peer-view">
            <TabsTrigger value="map" data-testid="tab-map">
              <MapPin className="w-4 h-4 mr-1.5" />
              Map
            </TabsTrigger>
            <TabsTrigger value="graph" data-testid="tab-graph">
              <Network className="w-4 h-4 mr-1.5" />
              Graph
            </TabsTrigger>
            <TabsTrigger value="table" data-testid="tab-table">
              <LayoutList className="w-4 h-4 mr-1.5" />
              Table
            </TabsTrigger>
          </TabsList>

          <TabsContent value="map" className="space-y-4">
            <PeerGeoMap />
          </TabsContent>

          <TabsContent value="graph" className="space-y-4">
            <PeerNetworkGraph peers={peers} />
            <VersionDistribution peers={peers} />
          </TabsContent>

          <TabsContent value="table">
            <PeerTable peers={peers} />
          </TabsContent>
        </Tabs>
      </motion.div>
    </motion.div>
  );
}
