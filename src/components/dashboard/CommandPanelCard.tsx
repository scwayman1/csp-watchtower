import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { MiniSparkline } from "./MiniSparkline";

interface CommandPanelCardProps {
  label: string;
  value: string;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  onClick?: () => void;
  sparklineData?: number[];
  sparklineColor?: string;
}

export function CommandPanelCard({ 
  label, 
  value, 
  subtitle, 
  icon: Icon, 
  trend, 
  onClick,
  sparklineData,
  sparklineColor = "auto"
}: CommandPanelCardProps) {
  return (
    <Card 
      className={`overflow-hidden ${onClick ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
          {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
        </div>
        <div className="space-y-1">
          <div className="text-2xl font-bold">{value}</div>
          {sparklineData && sparklineData.length >= 2 && (
            <div className="mt-1">
              <MiniSparkline data={sparklineData} color={sparklineColor} height={24} />
            </div>
          )}
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
