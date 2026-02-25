import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Bell,
  BellOff,
  Check,
  Cpu,
  HardDrive,
  Users,
  Clock,
  AlertTriangle,
  AlertOctagon,
  ShieldCheck,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Alert, AlertThreshold } from "@shared/schema";

const metricIcons: Record<string, typeof Cpu> = {
  cpu: Cpu,
  memory: HardDrive,
  peers: Users,
  ledger_age: Clock,
};

const metricLabels: Record<string, string> = {
  cpu: "CPU Load",
  memory: "Memory",
  peers: "Peer Count",
  ledger_age: "Ledger Age",
};

function formatTimestamp(ts: string | Date): string {
  const d = new Date(ts);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function AlertRow({ alert, onAcknowledge, isPending }: {
  alert: Alert;
  onAcknowledge: (id: number) => void;
  isPending: boolean;
}) {
  const Icon = metricIcons[alert.type] || AlertTriangle;
  const isWarning = alert.severity === "warning";
  const isCritical = alert.severity === "critical";

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
    >
      <Card
        className={`${!alert.acknowledged && isCritical ? "cyber-glow-strong" : ""} ${!alert.acknowledged && isWarning ? "cyber-glow" : ""}`}
        data-testid={`card-alert-${alert.id}`}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div
                className={`flex-shrink-0 p-2 rounded-md ${
                  isCritical
                    ? "bg-destructive/10 text-destructive"
                    : isWarning
                    ? "bg-amber-500/10 text-amber-500"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Badge
                    variant={isCritical ? "destructive" : "secondary"}
                    className={`text-[10px] uppercase tracking-wider ${
                      isWarning ? "bg-amber-500/15 text-amber-500" : ""
                    }`}
                    data-testid={`badge-severity-${alert.id}`}
                  >
                    {isCritical ? (
                      <AlertOctagon className="w-3 h-3 mr-1" />
                    ) : (
                      <AlertTriangle className="w-3 h-3 mr-1" />
                    )}
                    {alert.severity}
                  </Badge>
                  <span
                    className="text-[10px] font-mono text-muted-foreground tracking-wider"
                    data-testid={`text-alert-time-${alert.id}`}
                  >
                    {formatTimestamp(alert.timestamp)}
                  </span>
                  {alert.acknowledged && (
                    <Badge variant="secondary" className="text-[10px]">
                      <ShieldCheck className="w-3 h-3 mr-1" />
                      ACK
                    </Badge>
                  )}
                </div>
                <p
                  className="text-sm font-mono"
                  data-testid={`text-alert-message-${alert.id}`}
                >
                  {alert.message}
                </p>
                {alert.value != null && alert.threshold != null && (
                  <p className="text-xs text-muted-foreground font-mono mt-1">
                    Value: <span className={isCritical ? "text-destructive" : isWarning ? "text-amber-500" : ""}>{alert.value.toFixed(1)}</span>
                    {" / "}
                    Threshold: {alert.threshold.toFixed(1)}
                  </p>
                )}
              </div>
            </div>
            {!alert.acknowledged && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAcknowledge(alert.id)}
                disabled={isPending}
                data-testid={`button-acknowledge-${alert.id}`}
              >
                <Check className="w-3 h-3 mr-1" />
                Acknowledge
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ThresholdRow({ threshold, onUpdate }: {
  threshold: AlertThreshold;
  onUpdate: (id: number, data: Partial<AlertThreshold>) => void;
}) {
  const Icon = metricIcons[threshold.metric] || AlertTriangle;
  const [warningVal, setWarningVal] = useState(String(threshold.warningValue));
  const [criticalVal, setCriticalVal] = useState(String(threshold.criticalValue));

  useEffect(() => {
    setWarningVal(String(threshold.warningValue));
    setCriticalVal(String(threshold.criticalValue));
  }, [threshold.warningValue, threshold.criticalValue]);

  const handleWarningBlur = () => {
    const v = parseFloat(warningVal);
    if (!isNaN(v) && v !== threshold.warningValue) {
      onUpdate(threshold.id, { warningValue: v });
    }
  };

  const handleCriticalBlur = () => {
    const v = parseFloat(criticalVal);
    if (!isNaN(v) && v !== threshold.criticalValue) {
      onUpdate(threshold.id, { criticalValue: v });
    }
  };

  const unit = threshold.metric === "ledger_age" ? "s" : threshold.metric === "peers" ? "" : "%";

  return (
    <Card data-testid={`card-threshold-${threshold.metric}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-muted">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-mono font-medium" data-testid={`text-threshold-metric-${threshold.metric}`}>
                {metricLabels[threshold.metric] || threshold.metric}
              </p>
              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                {threshold.direction === "above" ? "Triggers when above" : "Triggers when below"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-amber-500 font-mono uppercase tracking-wider">Warning</span>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={warningVal}
                  onChange={(e) => setWarningVal(e.target.value)}
                  onBlur={handleWarningBlur}
                  className="w-20 text-center font-mono text-sm"
                  data-testid={`input-warning-${threshold.metric}`}
                />
                <span className="text-xs text-muted-foreground">{unit}</span>
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-destructive font-mono uppercase tracking-wider">Critical</span>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={criticalVal}
                  onChange={(e) => setCriticalVal(e.target.value)}
                  onBlur={handleCriticalBlur}
                  className="w-20 text-center font-mono text-sm"
                  data-testid={`input-critical-${threshold.metric}`}
                />
                <span className="text-xs text-muted-foreground">{unit}</span>
              </div>
            </div>
            <Switch
              checked={threshold.enabled}
              onCheckedChange={(checked) => onUpdate(threshold.id, { enabled: checked })}
              data-testid={`switch-threshold-${threshold.metric}`}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AlertsPage() {
  const { toast } = useToast();
  const lastAlertCountRef = useRef<number | null>(null);

  const { data: alerts, isLoading: alertsLoading } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
    refetchInterval: 10000,
  });

  const { data: unacknowledged } = useQuery<Alert[]>({
    queryKey: ["/api/alerts/unacknowledged"],
    refetchInterval: 10000,
  });

  const { data: thresholds, isLoading: thresholdsLoading } = useQuery<AlertThreshold[]>({
    queryKey: ["/api/alerts/thresholds"],
  });

  useEffect(() => {
    if (unacknowledged && lastAlertCountRef.current !== null) {
      if (unacknowledged.length > lastAlertCountRef.current) {
        const newest = unacknowledged[0];
        if (newest) {
          toast({
            title: `${newest.severity === "critical" ? "CRITICAL" : "Warning"} Alert`,
            description: newest.message,
            variant: newest.severity === "critical" ? "destructive" : "default",
          });
        }
      }
    }
    if (unacknowledged) {
      lastAlertCountRef.current = unacknowledged.length;
    }
  }, [unacknowledged, toast]);

  const acknowledgeMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/alerts/${id}/acknowledge`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/unacknowledged"] });
    },
  });

  const updateThresholdMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<AlertThreshold> }) => {
      await apiRequest("PUT", `/api/alerts/thresholds/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/thresholds"] });
      toast({ title: "Threshold Updated", description: "Alert threshold has been updated." });
    },
  });

  const handleAcknowledge = (id: number) => {
    acknowledgeMutation.mutate(id);
  };

  const handleUpdateThreshold = (id: number, data: Partial<AlertThreshold>) => {
    updateThresholdMutation.mutate({ id, data });
  };

  const activeAlerts = alerts?.filter((a) => !a.acknowledged) || [];
  const acknowledgedAlerts = alerts?.filter((a) => a.acknowledged) || [];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-3 mb-1 flex-wrap">
          <Bell className="w-5 h-5 text-primary" />
          <h1
            className="text-xl font-bold tracking-tight font-mono text-glow"
            data-testid="text-page-title"
          >
            ALERT CENTER
          </h1>
          {activeAlerts.length > 0 && (
            <Badge variant="destructive" className="text-xs" data-testid="badge-active-count">
              {activeAlerts.length} active
            </Badge>
          )}
        </div>
        <div className="neon-line" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">
            Threshold Configuration
          </h2>
        </div>
        <div className="space-y-3">
          {thresholdsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))
          ) : (
            thresholds?.map((t) => (
              <ThresholdRow
                key={t.id}
                threshold={t}
                onUpdate={handleUpdateThreshold}
              />
            ))
          )}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <div className="neon-line mb-6" />
        <div className="flex items-center gap-2 mb-3">
          <Bell className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">
            Alert History
          </h2>
        </div>

        {alertsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : alerts && alerts.length > 0 ? (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {activeAlerts.map((alert) => (
                <AlertRow
                  key={alert.id}
                  alert={alert}
                  onAcknowledge={handleAcknowledge}
                  isPending={acknowledgeMutation.isPending}
                />
              ))}
            </AnimatePresence>

            {activeAlerts.length > 0 && acknowledgedAlerts.length > 0 && (
              <div className="neon-line my-4" />
            )}

            <AnimatePresence mode="popLayout">
              {acknowledgedAlerts.map((alert) => (
                <AlertRow
                  key={alert.id}
                  alert={alert}
                  onAcknowledge={handleAcknowledge}
                  isPending={acknowledgeMutation.isPending}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 flex flex-col items-center justify-center gap-3">
              <BellOff className="w-8 h-8 text-muted-foreground" />
              <p className="text-sm font-mono text-muted-foreground" data-testid="text-no-alerts">
                No alerts recorded yet
              </p>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </div>
  );
}
