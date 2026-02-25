interface ResourceBarProps {
  label: string;
  used: string;
  total: string;
  percent: number;
}

function getBarColor(percent: number): { bg: string; glow: string } {
  if (percent < 50)
    return { bg: "bg-green-500 dark:bg-green-400", glow: "rgba(34, 197, 94, 0.4)" };
  if (percent < 75)
    return { bg: "bg-yellow-500 dark:bg-yellow-400", glow: "rgba(245, 158, 11, 0.4)" };
  if (percent < 90)
    return { bg: "bg-orange-500 dark:bg-orange-400", glow: "rgba(249, 115, 22, 0.4)" };
  return { bg: "bg-red-500 dark:bg-red-400", glow: "rgba(239, 68, 68, 0.5)" };
}

export function ResourceBar({ label, used, total, percent }: ResourceBarProps) {
  const clampedPercent = Math.min(100, Math.max(0, percent));
  const { bg, glow } = getBarColor(clampedPercent);

  return (
    <div className="space-y-2" data-testid={`resource-bar-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-sm font-medium uppercase tracking-wider">{label}</span>
        <span className="text-sm text-muted-foreground font-mono">
          {used} / {total}
        </span>
      </div>
      <div className="relative h-3 w-full rounded-md bg-muted overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-md transition-all duration-700 ease-out ${bg}`}
          style={{
            width: `${clampedPercent}%`,
            boxShadow: `0 0 8px ${glow}, 0 0 16px ${glow}`,
          }}
        >
          <div
            className="absolute inset-0 overflow-hidden rounded-md"
            style={{
              background:
                "repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(255,255,255,0.08) 4px, rgba(255,255,255,0.08) 8px)",
              animation: "data-flow 3s linear infinite",
            }}
          />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="relative w-full h-2 flex-1">
          {[25, 50, 75].map((tick) => (
            <div
              key={tick}
              className="absolute top-0 h-1.5 border-l border-muted-foreground/30"
              style={{ left: `${tick}%` }}
            />
          ))}
        </div>
        <span className="text-xs font-mono text-glow" style={{ color: clampedPercent > 75 ? "hsl(var(--destructive))" : "hsl(var(--primary))" }}>
          {clampedPercent.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
