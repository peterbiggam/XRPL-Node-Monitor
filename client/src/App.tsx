import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AnimatedBackground } from "@/components/animated-bg";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wifi, WifiOff, Volume2, VolumeX, Maximize, Minimize } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { playSound, isSoundEnabled, setSoundEnabled } from "@/lib/sounds";
import NotFound from "@/pages/not-found";
import SettingsPage from "@/pages/settings";
import SystemHealthPage from "@/pages/system-health";
import DashboardPage from "@/pages/dashboard";
import LedgerPage from "@/pages/ledger";
import PeersPage from "@/pages/peers";
import TransactionsPage from "@/pages/transactions";
import AlertsPage from "@/pages/alerts";
import AiAnalysisPage from "@/pages/ai-analysis";
import ValidatorsPage from "@/pages/validators";
import HistoryPage from "@/pages/history";
import ExplorerPage from "@/pages/explorer";

function LiveClock() {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatted = time.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <span
      className="font-mono text-xs text-primary text-glow tracking-wider"
      data-testid="text-live-clock"
    >
      {formatted}
    </span>
  );
}

function FullscreenToggle() {
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    const handler = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggle = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  };

  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={toggle}
      data-testid="button-fullscreen-toggle"
    >
      {isFs ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
    </Button>
  );
}

function SoundToggle() {
  const [enabled, setEnabled] = useState(() => isSoundEnabled());

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    setSoundEnabled(next);
  };

  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={toggle}
      data-testid="button-sound-toggle"
    >
      {enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
    </Button>
  );
}

function ConnectionStatus() {
  const { data, isError } = useQuery<{ status: string; data: unknown }>({
    queryKey: ["/api/node/info"],
    refetchInterval: 10000,
  });

  const connected = !isError && data?.status === "connected";
  const prevConnected = useRef<boolean | null>(null);

  useEffect(() => {
    if (prevConnected.current === null) {
      prevConnected.current = connected;
      return;
    }
    if (prevConnected.current && !connected) {
      playSound("connectionLost");
    } else if (!prevConnected.current && connected) {
      playSound("connectionRestored");
    }
    prevConnected.current = connected;
  }, [connected]);

  return (
    <Badge
      variant={connected ? "default" : "secondary"}
      className={`no-default-active-elevate ${connected ? "cyber-glow" : ""}`}
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
      <Route path="/alerts" component={AlertsPage} />
      <Route path="/explorer" component={ExplorerPage} />
      <Route path="/history" component={HistoryPage} />
      <Route path="/validators" component={ValidatorsPage} />
      <Route path="/system" component={SystemHealthPage} />
      <Route path="/ai" component={AiAnalysisPage} />
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
          <AnimatedBackground />
          <SidebarProvider style={style as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1 min-w-0">
                <header className="flex items-center justify-between gap-2 p-2 border-b sticky top-0 z-50 bg-background/80 backdrop-blur-sm">
                  <div className="flex items-center gap-3 flex-wrap">
                    <SidebarTrigger data-testid="button-sidebar-toggle" />
                    <span
                      className="text-[10px] tracking-widest uppercase font-mono text-muted-foreground hidden sm:inline"
                      data-testid="text-header-title"
                    >
                      XRPL NODE CONTROL
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <LiveClock />
                    <ConnectionStatus />
                    <SoundToggle />
                    <FullscreenToggle />
                    <ThemeToggle />
                  </div>
                </header>
                <div className="neon-line" />
                <main className="flex-1 overflow-auto grid-bg">
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
