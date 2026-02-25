import { cn } from "@/lib/utils";

type StatusType = "synced" | "syncing" | "disconnected";

interface StatusIndicatorProps {
  status: StatusType;
  label?: string;
  className?: string;
}

const statusConfig: Record<StatusType, { color: string; glowColor: string; ringColor: string; label: string }> = {
  synced: {
    color: "bg-status-online",
    glowColor: "shadow-[0_0_8px_rgba(34,197,94,0.6),0_0_16px_rgba(34,197,94,0.3)]",
    ringColor: "bg-status-online/40",
    label: "Synced",
  },
  syncing: {
    color: "bg-status-away",
    glowColor: "shadow-[0_0_8px_rgba(245,158,11,0.6),0_0_16px_rgba(245,158,11,0.3)]",
    ringColor: "bg-status-away/40",
    label: "Syncing",
  },
  disconnected: {
    color: "bg-status-busy",
    glowColor: "shadow-[0_0_8px_rgba(239,68,68,0.6),0_0_16px_rgba(239,68,68,0.3)]",
    ringColor: "bg-status-busy/40",
    label: "Disconnected",
  },
};

const textGlowStyles: Record<StatusType, React.CSSProperties> = {
  synced: { textShadow: "0 0 8px rgba(34,197,94,0.5)" },
  syncing: { textShadow: "0 0 8px rgba(245,158,11,0.5)" },
  disconnected: { textShadow: "0 0 8px rgba(239,68,68,0.5)" },
};

export function StatusIndicator({ status, label, className }: StatusIndicatorProps) {
  const config = statusConfig[status];

  return (
    <div className={cn("flex items-center gap-2", className)} data-testid={`status-indicator-${status}`}>
      <span className="relative flex h-5 w-5 items-center justify-center">
        <svg
          viewBox="0 0 20 20"
          className="absolute inset-0 w-5 h-5 text-muted-foreground/20"
          fill="currentColor"
        >
          <polygon points="10,0 18.66,5 18.66,15 10,20 1.34,15 1.34,5" />
        </svg>
        {status !== "disconnected" && (
          <span
            className={cn(
              "absolute inset-1 rounded-full animate-pulse-ring",
              config.ringColor
            )}
          />
        )}
        <span
          className={cn(
            "relative inline-flex h-3 w-3 rounded-full z-10",
            config.color,
            config.glowColor,
            status !== "disconnected" && "animate-pulse-glow"
          )}
        />
      </span>
      {(label ?? config.label) && (
        <span
          className="text-sm font-mono uppercase tracking-wider"
          style={textGlowStyles[status]}
          data-testid={`text-status-${status}`}
        >
          {label ?? config.label}
        </span>
      )}
    </div>
  );
}
