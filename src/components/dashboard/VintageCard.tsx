import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface VintageCardProps {
  period: string;
  performancePct: number;
  premiumPct: number;
  totalPnL: number;
  isActive?: boolean;
  onClick?: () => void;
}

export function VintageCard({ 
  period, 
  performancePct, 
  premiumPct, 
  totalPnL, 
  isActive = false,
  onClick 
}: VintageCardProps) {
  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  return (
    <Card 
      className={`min-w-[200px] cursor-pointer transition-all hover:scale-105 ${
        isActive ? 'ring-2 ring-primary shadow-lg' : ''
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <h4 className="font-semibold text-sm mb-3">{period}</h4>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Performance</span>
            <Badge variant={performancePct >= 0 ? "default" : "destructive"} className="text-xs">
              {performancePct >= 0 ? '+' : ''}{performancePct.toFixed(1)}%
            </Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Premium</span>
            <span className="text-xs font-medium">{premiumPct.toFixed(1)}%</span>
          </div>
          <div className="pt-2 border-t border-border">
            <span className={`text-lg font-bold ${totalPnL >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatCurrency(totalPnL)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
