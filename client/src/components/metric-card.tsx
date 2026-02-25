import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subValue?: string;
  trend?: "up" | "down" | "neutral";
  className?: string;
  children?: React.ReactNode;
  testId?: string;
}

export function MetricCard({
  icon: Icon,
  label,
  value,
  subValue,
  className,
  children,
  testId,
}: MetricCardProps) {
  return (
    <Card className={cn("overflow-visible", className)} data-testid={testId}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-sm text-muted-foreground" data-testid={`text-label-${testId}`}>
            {label}
          </span>
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted/50">
            <Icon className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-2xl font-semibold font-mono tracking-tight" data-testid={`text-value-${testId}`}>
            {value}
          </p>
          {subValue && (
            <p className="text-xs text-muted-foreground" data-testid={`text-subvalue-${testId}`}>
              {subValue}
            </p>
          )}
        </div>
        {children && <div className="mt-3">{children}</div>}
      </CardContent>
    </Card>
  );
}
