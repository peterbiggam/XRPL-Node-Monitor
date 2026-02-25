import { cn } from "@/lib/utils";

type StatusType = "synced" | "syncing" | "disconnected";

interface StatusIndicatorProps {
  status: StatusType;
  label?: string;
  className?: string;
}

const statusConfig: Record<StatusType, { color: string; ringColor: string; label: string }> = {
  synced: {
    color: "bg-status-online",
    ringColor: "bg-status-online/40",
    label: "Synced",
  },
  syncing: {
    color: "bg-status-away",
    ringColor: "bg-status-away/40",
    label: "Syncing",
  },
  disconnected: {
    color: "bg-status-busy",
    ringColor: "bg-status-busy/40",
    label: "Disconnected",
  },
};

export function StatusIndicator({ status, label, className }: StatusIndicatorProps) {
  const config = statusConfig[status];

  return (
    <div className={cn("flex items-center gap-2", className)} data-testid={`status-indicator-${status}`}>
      <span className="relative flex h-3 w-3">
        {status !== "disconnected" && (
          <span
            className={cn(
              "absolute inset-0 rounded-full animate-pulse-ring",
              config.ringColor
            )}
          />
        )}
        <span
          className={cn(
            "relative inline-flex h-3 w-3 rounded-full",
            config.color,
            status !== "disconnected" && "animate-pulse-glow"
          )}
        />
      </span>
      {(label ?? config.label) && (
        <span className="text-sm text-muted-foreground" data-testid={`text-status-${status}`}>
          {label ?? config.label}
        </span>
      )}
    </div>
  );
}
