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

function PeerSummary({ peers }: { peers: PeerInfo[] }) {
  const totalPeers = peers.length;
  const inbound = peers.filter((p) => p.inbound).length;
  const outbound = totalPeers - inbound;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card>
        <CardContent className="flex items-center gap-3 py-4">
          <div className="p-2 rounded-md bg-muted">
            <Users className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Peers</p>
            <p className="text-2xl font-semibold" data-testid="text-total-peers">{totalPeers}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-center gap-3 py-4">
          <div className="p-2 rounded-md bg-muted">
            <ArrowDownLeft className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Inbound</p>
            <p className="text-2xl font-semibold" data-testid="text-inbound-peers">{inbound}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-center gap-3 py-4">
          <div className="p-2 rounded-md bg-muted">
            <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Outbound</p>
            <p className="text-2xl font-semibold" data-testid="text-outbound-peers">{outbound}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PeerTable({ peers }: { peers: PeerInfo[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Connected Peers</CardTitle>
        <Globe className="w-4 h-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="overflow-auto max-h-[500px]">
          <Table data-testid="table-peers">
            <TableHeader>
              <TableRow>
                <TableHead>Address</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Version</TableHead>
                <TableHead className="text-right">Latency</TableHead>
                <TableHead className="text-right">Uptime</TableHead>
                <TableHead>Ledgers</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {peers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No peers connected
                  </TableCell>
                </TableRow>
              ) : (
                peers.map((peer, index) => (
                  <TableRow key={peer.publicKey || index} data-testid={`row-peer-${index}`}>
                    <TableCell className="font-mono text-xs">
                      {maskAddress(peer.address)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={peer.inbound ? "secondary" : "default"}
                        className="no-default-active-elevate"
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
                    <TableCell className="text-xs text-muted-foreground">
                      {peer.version || "N/A"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {peer.latency ? `${peer.latency}ms` : "N/A"}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      <div className="flex items-center justify-end gap-1">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        {formatUptime(peer.uptime)}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
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
  );
}

function PeersSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="h-96" />
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
          <Users className="w-6 h-6" />
          <h1 className="text-xl font-semibold">Peers</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center" data-testid="text-peers-error">
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
        <Users className="w-6 h-6" />
        <h1 className="text-xl font-semibold" data-testid="text-page-title">Peers</h1>
      </div>

      <PeerSummary peers={peers} />
      <PeerTable peers={peers} />
    </div>
  );
}
