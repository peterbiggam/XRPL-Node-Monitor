/**
 * metric-card.tsx — Reusable card for displaying a single numeric metric.
 *
 * Props:
 *  - icon: Lucide icon rendered inside a hexagonal clip-path container.
 *  - label: Uppercase metric name shown above the value.
 *  - value: Primary numeric/string value, styled with a glowing mono font.
 *  - subValue: Optional secondary text below the value (e.g. units or context).
 *  - children: Optional extra content rendered below the value area.
 *  - testId: Sets data-testid on the outer card for testing.
 *
 * Visual details:
 *  - A thin gradient "data flow" animation runs along the top edge.
 *  - The icon is clipped to a hexagon shape via CSS clip-path to match
 *    the app's cyber/hex theme.
 *  - A decorative "//" marker sits in the top-right corner.
 */

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
    <Card
      className={cn(
        "overflow-visible cyber-border hover:cyber-glow transition-shadow duration-300 relative",
        className
      )}
      data-testid={testId}
    >
      <div className="absolute top-0 left-0 right-0 h-[2px] overflow-hidden rounded-t-md">
        <div className="h-full w-full bg-gradient-to-r from-transparent via-primary to-transparent animate-data-flow" />
      </div>

      <div className="absolute top-2 right-2 text-primary/30 font-mono text-[10px] leading-none select-none" aria-hidden="true">
        {"//"}
      </div>

      <CardContent className="p-4 pt-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-sm text-muted-foreground uppercase tracking-wider font-mono" data-testid={`text-label-${testId}`}>
            {label}
          </span>
          <div
            className="flex items-center justify-center w-9 h-9 bg-primary/10 text-primary"
            style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }}
          >
            <Icon className="w-4 h-4" />
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-2xl font-semibold font-mono tracking-tight text-primary text-glow" data-testid={`text-value-${testId}`}>
            {value}
          </p>
          {subValue && (
            <p className="text-xs text-muted-foreground font-mono" data-testid={`text-subvalue-${testId}`}>
              {subValue}
            </p>
          )}
        </div>
        {children && <div className="mt-3">{children}</div>}
      </CardContent>
    </Card>
  );
}
