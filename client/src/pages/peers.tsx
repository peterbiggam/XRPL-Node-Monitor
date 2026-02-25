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
import { Users, ArrowDownLeft, ArrowUpRight, Globe, Clock, Network, LayoutList } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { PeerInfo } from "@shared/schema";

interface PeersResponse {
  status: string;
  data: PeerInfo[] | null;
  message?: string;
}

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

function hexagonPath(cx: number, cy: number, r: number): string {
  const points: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return `M${points.join("L")}Z`;
}

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
        <Tabs defaultValue="graph" data-testid="tabs-peer-view">
          <TabsList data-testid="tabslist-peer-view">
            <TabsTrigger value="graph" data-testid="tab-graph">
              <Network className="w-4 h-4 mr-1.5" />
              Graph
            </TabsTrigger>
            <TabsTrigger value="table" data-testid="tab-table">
              <LayoutList className="w-4 h-4 mr-1.5" />
              Table
            </TabsTrigger>
          </TabsList>

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
