import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, ArrowDownLeft, ArrowUpRight, Globe, Clock } from "lucide-react";
import { motion } from "framer-motion";
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
      {stats.map((stat, i) => (
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
      <PeerTable peers={peers} />
    </motion.div>
  );
}
