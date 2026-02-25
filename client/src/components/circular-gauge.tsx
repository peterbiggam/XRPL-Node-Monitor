interface CircularGaugeProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
}

function getGaugeColor(percent: number): string {
  if (percent < 50) return "hsl(142, 71%, 45%)";
  if (percent < 75) return "hsl(48, 96%, 53%)";
  if (percent < 90) return "hsl(25, 95%, 53%)";
  return "hsl(0, 84%, 50%)";
}

export function CircularGauge({
  value,
  size = 140,
  strokeWidth = 10,
  label,
  sublabel,
}: CircularGaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedValue = Math.min(100, Math.max(0, value));
  const offset = circumference - (clampedValue / 100) * circumference;
  const color = getGaugeColor(clampedValue);

  return (
    <div className="flex flex-col items-center gap-2" data-testid="gauge-container">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90"
          data-testid="gauge-svg"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold font-mono" data-testid="gauge-value">
            {clampedValue.toFixed(1)}%
          </span>
          {label && (
            <span className="text-xs text-muted-foreground" data-testid="gauge-label">
              {label}
            </span>
          )}
        </div>
      </div>
      {sublabel && (
        <span className="text-sm text-muted-foreground" data-testid="gauge-sublabel">
          {sublabel}
        </span>
      )}
    </div>
  );
}
