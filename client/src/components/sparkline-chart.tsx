import { ResponsiveContainer, AreaChart, Area } from "recharts";

interface SparklineChartProps {
  data: number[];
  color?: string;
  height?: number;
  className?: string;
}

export function SparklineChart({
  data,
  color = "hsl(var(--chart-1))",
  height = 40,
  className,
}: SparklineChartProps) {
  const chartData = data.map((value, index) => ({ index, value }));

  if (chartData.length < 2) {
    return null;
  }

  const gradientId = `sparkGrad-${color.replace(/[^a-zA-Z0-9]/g, "")}`;
  const glowId = `sparkGlow-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <div className={className} data-testid="chart-sparkline">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
            <filter id={glowId}>
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            dot={false}
            isAnimationActive={false}
            filter={`url(#${glowId})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
