import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface CommandPanelCardProps {
  label: string;
  value: string;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

export function CommandPanelCard({ label, value, subtitle, icon: Icon, trend }: CommandPanelCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
          {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
        </div>
        <div className="space-y-1">
          <div className="text-2xl font-bold">{value}</div>
          {trend && (
            <div className={`text-sm font-medium ${trend.isPositive ? 'text-success' : 'text-destructive'}`}>
              {trend.isPositive ? '+' : ''}{trend.value}
            </div>
          )}
          {subtitle && (
            <div className="text-xs text-muted-foreground">{subtitle}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
