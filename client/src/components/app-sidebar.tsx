/**
 * app-sidebar.tsx — Main navigation sidebar for XRPL Node Monitor.
 *
 * Contains: animated hexagon logo, a dropdown node switcher (to change the
 * active XRPL node), navigation menu with a live unacknowledged-alert badge
 * on the "Alert Center" item, and a "SYS ONLINE" footer indicator.
 */

import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SavedNode } from "@shared/schema";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  ArrowRightLeft,
  Activity,
  Settings,
  ChevronDown,
  Server,
  Check,
  Clock,
  Bell,
  Search,
  Shield,
  Brain,
  GitCompare,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Alert } from "@shared/schema";

/** Sidebar nav items — order determines display order, icons from lucide-react. */
const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Metrics History", url: "/history", icon: Clock },
  { title: "Alert Center", url: "/alerts", icon: Bell },
  { title: "Network Explorer", url: "/explorer", icon: Search },
  { title: "Ledger Explorer", url: "/ledger", icon: BookOpen },
  { title: "Peers", url: "/peers", icon: Users },
  { title: "Transactions", url: "/transactions", icon: ArrowRightLeft },
  { title: "Validators", url: "/validators", icon: Shield },
  { title: "AI Analysis", url: "/ai", icon: Brain },
  { title: "Comparison", url: "/comparison", icon: GitCompare },
  { title: "System Health", url: "/system", icon: Activity },
  { title: "Settings", url: "/settings", icon: Settings },
];

/** Decorative double-hexagon SVG logo with a pulsing glow and centered Activity icon. */
function HexagonLogo() {
  return (
    <div className="relative flex items-center justify-center w-12 h-12">
      <svg
        viewBox="0 0 60 60"
        className="absolute inset-0 w-full h-full animate-pulse-glow"
        data-testid="img-hexagon-logo"
      >
        <polygon
          points="30,2 54,16 54,44 30,58 6,44 6,16"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="1.5"
          opacity="0.6"
        />
        <polygon
          points="30,8 48,19 48,41 30,52 12,41 12,19"
          fill="hsl(var(--primary) / 0.08)"
          stroke="hsl(var(--primary))"
          strokeWidth="0.8"
          opacity="0.4"
        />
      </svg>
      <Activity className="w-5 h-5 text-primary relative z-10" style={{ filter: "drop-shadow(0 0 6px rgba(0, 230, 255, 0.5))" }} />
    </div>
  );
}

/**
 * Dropdown menu to switch between saved XRPL nodes.
 * Fetches the node list from /api/nodes; the active node is marked with a checkmark.
 * Activating a different node POSTs to /api/nodes/:id/activate and invalidates
 * related query caches so the UI refreshes with the new node's data.
 */
function NodeSwitcher() {
  const [, setLocation] = useLocation();

  const { data: nodes } = useQuery<SavedNode[]>({
    queryKey: ["/api/nodes"],
  });

  const activateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/nodes/${id}/activate`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/node"] });
      queryClient.invalidateQueries({ queryKey: ["/api/connection"] });
    },
  });

  const activeNode = nodes?.find((n) => n.isActive);
  const hasNodes = nodes && nodes.length > 0;

  if (!hasNodes) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between font-mono text-xs gap-2"
          data-testid="button-node-switcher"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Server className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {activeNode ? activeNode.name : "No active node"}
            </span>
          </div>
          <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-[10px] tracking-widest uppercase font-mono text-muted-foreground">
          Switch Node
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {nodes?.map((node) => (
          <DropdownMenuItem
            key={node.id}
            onClick={() => {
              if (!node.isActive) {
                activateMutation.mutate(node.id);
              }
            }}
            className="gap-2 font-mono text-xs"
            data-testid={`menu-item-node-${node.id}`}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="truncate">{node.name}</span>
              <span className="text-[10px] text-muted-foreground truncate">
                {node.host}
              </span>
            </div>
            {node.isActive && (
              <Check className="w-3.5 h-3.5 text-primary shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setLocation("/settings")}
          className="gap-2 font-mono text-xs"
          data-testid="menu-item-manage-nodes"
        >
          <Settings className="w-3.5 h-3.5" />
          Manage Nodes
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Full sidebar component.
 * Polls /api/alerts every 10s to compute the unacknowledged alert count,
 * which is displayed as a pulsing destructive badge next to "Alert Center".
 * The active nav item is highlighted with a glowing left-edge indicator bar.
 */
export function AppSidebar() {
  const [location] = useLocation();

  const { data: alerts } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
    refetchInterval: 10000,
  });

  const unacknowledgedCount = alerts?.filter((a) => !a.acknowledged).length ?? 0;

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <HexagonLogo />
          <div className="flex flex-col">
            <span
              className="text-lg font-bold tracking-tight text-glow font-sans"
              data-testid="text-app-title"
            >
              XRPL
            </span>
            <span className="text-[10px] tracking-widest uppercase text-muted-foreground font-mono">
              NODE MONITOR
            </span>
          </div>
        </div>
        <div className="neon-line mt-3" />
        <div className="mt-2">
          <NodeSwitcher />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] tracking-widest uppercase font-mono text-muted-foreground">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location === item.url;
                const isAlertItem = item.title === "Alert Center";
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      data-testid={`link-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <Link href={item.url}>
                        <div className="flex items-center gap-3 w-full relative">
                          {isActive && (
                            <div
                              className="absolute left-[-12px] top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-sm"
                              style={{
                                backgroundColor: "hsl(var(--primary))",
                                boxShadow: "0 0 8px rgba(0, 230, 255, 0.6), 0 0 16px rgba(0, 230, 255, 0.3)",
                              }}
                              data-testid={`indicator-active-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                            />
                          )}
                          <item.icon className={`w-4 h-4 ${isActive ? "text-primary" : ""}`} />
                          <span className={`text-sm font-mono ${isActive ? "text-primary" : ""}`}>
                            {item.title}
                          </span>
                          {isAlertItem && unacknowledgedCount > 0 && (
                            <Badge
                              variant="destructive"
                              className="ml-auto h-5 min-w-5 px-1 text-[10px] font-mono animate-pulse"
                              data-testid="badge-alert-count"
                            >
                              {unacknowledgedCount}
                            </Badge>
                          )}
                        </div>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <div className="neon-line mb-3" />
        <div className="flex items-center gap-2" data-testid="status-system-online">
          <div className="relative flex items-center justify-center">
            <div
              className="w-2 h-2 rounded-full bg-green-500"
              style={{ boxShadow: "0 0 6px rgba(34, 197, 94, 0.8)" }}
            />
            <div className="absolute w-2 h-2 rounded-full bg-green-500 animate-pulse-ring" />
          </div>
          <span className="text-[10px] tracking-widest uppercase font-mono text-muted-foreground">
            SYS ONLINE
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
