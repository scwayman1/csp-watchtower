import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: LucideIcon;
  badgeVariant?: "success" | "warning" | "destructive" | "default";
  badgeLabel?: string;
  onClick?: () => void;
}

export function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon,
  badgeVariant,
  badgeLabel,
  onClick 
}: StatCardProps) {
  return (
    <Card 
      className={onClick ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs sm:text-sm font-medium">{title}</CardTitle>
        {Icon && <Icon className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-xl sm:text-2xl font-bold break-all">{value}</div>
          {badgeLabel && badgeVariant && (
            <Badge variant={badgeVariant} className="text-xs shrink-0">{badgeLabel}</Badge>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
