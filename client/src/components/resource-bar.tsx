interface ResourceBarProps {
  label: string;
  used: string;
  total: string;
  percent: number;
}

function getBarColor(percent: number): string {
  if (percent < 50) return "bg-green-500 dark:bg-green-400";
  if (percent < 75) return "bg-yellow-500 dark:bg-yellow-400";
  if (percent < 90) return "bg-orange-500 dark:bg-orange-400";
  return "bg-red-500 dark:bg-red-400";
}

export function ResourceBar({ label, used, total, percent }: ResourceBarProps) {
  const clampedPercent = Math.min(100, Math.max(0, percent));

  return (
    <div className="space-y-2" data-testid={`resource-bar-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm text-muted-foreground font-mono">
          {used} / {total}
        </span>
      </div>
      <div className="relative h-3 w-full rounded-md bg-muted overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-md transition-all duration-700 ease-out ${getBarColor(clampedPercent)}`}
          style={{ width: `${clampedPercent}%` }}
        />
      </div>
      <div className="flex items-center justify-end">
        <span className="text-xs text-muted-foreground font-mono">{clampedPercent.toFixed(1)}%</span>
      </div>
    </div>
  );
}
