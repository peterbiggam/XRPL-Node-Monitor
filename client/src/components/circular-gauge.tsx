import { useState, useEffect, useRef, useId } from "react";

interface CircularGaugeProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
}

function getGaugeColor(percent: number): string {
  if (percent < 50) return "hsl(185, 100%, 50%)";
  if (percent < 75) return "hsl(48, 96%, 53%)";
  if (percent < 90) return "hsl(25, 95%, 53%)";
  return "hsl(0, 84%, 50%)";
}

function getGaugeGlowColor(percent: number): string {
  if (percent < 50) return "rgba(0, 230, 255, 0.6)";
  if (percent < 75) return "rgba(255, 210, 50, 0.6)";
  if (percent < 90) return "rgba(255, 140, 50, 0.6)";
  return "rgba(255, 60, 60, 0.8)";
}

export function CircularGauge({
  value,
  size = 140,
  strokeWidth = 10,
  label,
  sublabel,
}: CircularGaugeProps) {
  const radius = (size - strokeWidth - 8) / 2;
  const outerRadius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedValue = Math.min(100, Math.max(0, value));
  const offset = circumference - (clampedValue / 100) * circumference;
  const color = getGaugeColor(clampedValue);
  const glowColor = getGaugeGlowColor(clampedValue);
  const cx = size / 2;
  const cy = size / 2;
  const isHighValue = clampedValue > 90;
  const uniqueId = useId().replace(/:/g, "");

  const [displayValue, setDisplayValue] = useState(0);
  const animRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const prevValueRef = useRef(0);

  useEffect(() => {
    const from = prevValueRef.current;
    const to = clampedValue;
    const duration = 700;
    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(from + (to - from) * eased);

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        prevValueRef.current = to;
      }
    };

    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [clampedValue]);

  const tickCount = 24;
  const ticks = Array.from({ length: tickCount }, (_, i) => {
    const angle = (i / tickCount) * 360 - 90;
    const rad = (angle * Math.PI) / 180;
    const innerTick = outerRadius - 6;
    const outerTick = outerRadius - 2;
    const isMajor = i % 6 === 0;
    return {
      x1: cx + (isMajor ? innerTick - 3 : innerTick) * Math.cos(rad),
      y1: cy + (isMajor ? innerTick - 3 : innerTick) * Math.sin(rad),
      x2: cx + outerTick * Math.cos(rad),
      y2: cy + outerTick * Math.sin(rad),
      isMajor,
    };
  });

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
          <defs>
            <filter id={`gauge-glow-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            {isHighValue && (
              <filter id={`gauge-pulse-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            )}
          </defs>

          <circle
            cx={cx}
            cy={cy}
            r={outerRadius}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth={1}
            opacity={0.3}
          />

          {ticks.map((tick, i) => (
            <line
              key={i}
              x1={tick.x1}
              y1={tick.y1}
              x2={tick.x2}
              y2={tick.y2}
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={tick.isMajor ? 1.5 : 0.5}
              opacity={tick.isMajor ? 0.5 : 0.25}
            />
          ))}

          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={strokeWidth}
            opacity={0.4}
          />

          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
            filter={`url(#gauge-glow-${uniqueId})`}
            style={isHighValue ? { animation: "flicker 4s ease-in-out infinite" } : undefined}
          />

          {isHighValue && (
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={glowColor}
              strokeWidth={strokeWidth + 6}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              opacity={0.15}
              filter={`url(#gauge-pulse-${uniqueId})`}
              className="transition-all duration-700 ease-out"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-2xl font-bold font-mono text-glow"
            style={{ color }}
            data-testid="gauge-value"
          >
            {displayValue.toFixed(1)}%
          </span>
          {label && (
            <span className="text-xs text-muted-foreground uppercase tracking-wider" data-testid="gauge-label">
              {label}
            </span>
          )}
        </div>
      </div>
      {sublabel && (
        <span className="text-sm text-muted-foreground font-mono" data-testid="gauge-sublabel">
          {sublabel}
        </span>
      )}
    </div>
  );
}
