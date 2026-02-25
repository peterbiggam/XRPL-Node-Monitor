import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff } from "lucide-react";
import NotFound from "@/pages/not-found";
import SettingsPage from "@/pages/settings";
import SystemHealthPage from "@/pages/system-health";
import DashboardPage from "@/pages/dashboard";
import LedgerPage from "@/pages/ledger";
import PeersPage from "@/pages/peers";
import TransactionsPage from "@/pages/transactions";

function ConnectionStatus() {
  const { data, isError } = useQuery<{ status: string; data: unknown }>({
    queryKey: ["/api/node/info"],
    refetchInterval: 10000,
  });

  const connected = !isError && data?.status === "connected";

  return (
    <Badge
      variant={connected ? "default" : "secondary"}
      className="no-default-active-elevate"
      data-testid="status-connection"
    >
      {connected ? (
        <Wifi className="w-3 h-3 mr-1" />
      ) : (
        <WifiOff className="w-3 h-3 mr-1" />
      )}
      {connected ? "Connected" : "Disconnected"}
    </Badge>
  );
}


function Router() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/ledger" component={LedgerPage} />
      <Route path="/peers" component={PeersPage} />
      <Route path="/transactions" component={TransactionsPage} />
      <Route path="/system" component={SystemHealthPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SidebarProvider style={style as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1 min-w-0">
                <header className="flex items-center justify-between gap-2 p-2 border-b sticky top-0 z-50 bg-background">
                  <div className="flex items-center gap-2 flex-wrap">
                    <SidebarTrigger data-testid="button-sidebar-toggle" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <ConnectionStatus />
                    <ThemeToggle />
                  </div>
                </header>
                <main className="flex-1 overflow-auto">
                  <Router />
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
