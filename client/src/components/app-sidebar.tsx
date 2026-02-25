import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  ArrowRightLeft,
  Activity,
  Settings,
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

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Ledger Explorer", url: "/ledger", icon: BookOpen },
  { title: "Peers", url: "/peers", icon: Users },
  { title: "Transactions", url: "/transactions", icon: ArrowRightLeft },
  { title: "System Health", url: "/system", icon: Activity },
  { title: "Settings", url: "/settings", icon: Settings },
];

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

export function AppSidebar() {
  const [location] = useLocation();

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
