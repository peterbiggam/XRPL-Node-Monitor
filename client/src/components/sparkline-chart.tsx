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

  return (
    <div className={className} data-testid="chart-sparkline">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`sparkGrad-${color.replace(/[^a-zA-Z0-9]/g, "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#sparkGrad-${color.replace(/[^a-zA-Z0-9]/g, "")})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
