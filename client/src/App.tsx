import { Switch, Route, useLocation } from "wouter";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wifi, WifiOff, Volume2, VolumeX, Maximize, Minimize, Keyboard, X } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
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
import ComparisonPage from "@/pages/comparison";

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
      <Route path="/comparison" component={ComparisonPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

const SHORTCUT_NAV: Record<string, string> = {
  d: "/",
  h: "/history",
  a: "/alerts",
  e: "/explorer",
  p: "/peers",
  v: "/validators",
  i: "/ai",
  s: "/settings",
  c: "/comparison",
};

const SHORTCUTS_HELP = [
  { keys: "g d", desc: "Dashboard" },
  { keys: "g h", desc: "Metrics History" },
  { keys: "g a", desc: "Alert Center" },
  { keys: "g e", desc: "Network Explorer" },
  { keys: "g p", desc: "Peers" },
  { keys: "g v", desc: "Validators" },
  { keys: "g i", desc: "AI Analysis" },
  { keys: "g s", desc: "Settings" },
  { keys: "g c", desc: "Comparison" },
  { keys: "f", desc: "Toggle Fullscreen" },
  { keys: "?", desc: "Show/Hide Shortcuts" },
];

function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      data-testid="modal-shortcuts-overlay"
    >
      <Card
        className="cyber-border w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
        data-testid="modal-shortcuts"
      >
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-primary" />
            <CardTitle className="font-mono text-sm tracking-wider">KEYBOARD SHORTCUTS</CardTitle>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} data-testid="button-close-shortcuts">
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-1">
          {SHORTCUTS_HELP.map((s) => (
            <div
              key={s.keys}
              className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0"
              data-testid={`shortcut-row-${s.keys.replace(/\s+/g, "-")}`}
            >
              <span className="font-mono text-xs text-muted-foreground">{s.desc}</span>
              <div className="flex items-center gap-1">
                {s.keys.split(" ").map((k, i) => (
                  <kbd
                    key={i}
                    className="px-2 py-0.5 rounded-md bg-muted font-mono text-[11px] font-bold border border-border/50"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function useKeyboardShortcuts() {
  const [, setLocation] = useLocation();
  const [showHelp, setShowHelp] = useState(false);
  const pendingG = useRef(false);
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || target.isContentEditable) return;

      const key = e.key.toLowerCase();

      if (key === "?") {
        e.preventDefault();
        setShowHelp((prev) => !prev);
        return;
      }

      if (key === "f" && !pendingG.current) {
        e.preventDefault();
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          document.documentElement.requestFullscreen();
        }
        return;
      }

      if (key === "g" && !pendingG.current) {
        e.preventDefault();
        pendingG.current = true;
        if (gTimer.current) clearTimeout(gTimer.current);
        gTimer.current = setTimeout(() => {
          pendingG.current = false;
        }, 1000);
        return;
      }

      if (pendingG.current) {
        pendingG.current = false;
        if (gTimer.current) clearTimeout(gTimer.current);
        const path = SHORTCUT_NAV[key];
        if (path) {
          e.preventDefault();
          setLocation(path);
        }
        return;
      }
    },
    [setLocation],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return { showHelp, setShowHelp };
}

function AppContent() {
  const { showHelp, setShowHelp } = useKeyboardShortcuts();

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <>
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
      <ShortcutsModal open={showHelp} onClose={() => setShowHelp(false)} />
      <Toaster />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AppContent />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
