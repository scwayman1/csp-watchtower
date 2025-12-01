import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, FileText, TrendingUp, DollarSign, Sparkles } from "lucide-react";
import { Position } from "./PositionsTable";
import { useMemo } from "react";

interface ActivePositionsBatchHeaderProps {
  positions: Position[];
}

export function ActivePositionsBatchHeader({ positions }: ActivePositionsBatchHeaderProps) {
  const metrics = useMemo(() => {
    if (positions.length === 0) return null;

    // Find the earliest opened date (or use a recent date as proxy)
    const today = new Date();
    const orderDate = today.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });

    // Calculate metrics
    const positionsCount = positions.length;
    const totalContracts = positions.reduce((sum, p) => sum + p.contracts, 0);
    const totalPremium = positions.reduce((sum, p) => sum + p.totalPremium, 0);
    const totalUnrealizedPnL = positions.reduce((sum, p) => sum + p.unrealizedPnL, 0);

    return {
      orderDate,
      positionsCount,
      totalContracts,
      totalPremium,
      totalUnrealizedPnL,
    };
  }, [positions]);

  if (!metrics) return null;

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  return (
    <Card className="mb-4 rounded-2xl bg-gradient-to-br from-primary/5 via-background to-accent/5 border-2 border-primary/20 shadow-lg relative overflow-hidden">
      {/* Festive decorative elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-accent/10 rounded-full blur-2xl" />
      
      <CardContent className="p-6 relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
            <h3 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Active Positions Batch
            </h3>
          </div>
          <Badge variant="default" className="text-xs font-semibold px-3 py-1">
            LIVE
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Order Date */}
          <div className="flex flex-col gap-1 p-3 rounded-lg bg-background/50 backdrop-blur-sm border border-border/50">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              <span>Order Date</span>
            </div>
            <span className="text-sm font-semibold">{metrics.orderDate}</span>
          </div>

          {/* Positions Count */}
          <div className="flex flex-col gap-1 p-3 rounded-lg bg-background/50 backdrop-blur-sm border border-border/50">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileText className="w-3.5 h-3.5" />
              <span>Positions</span>
            </div>
            <span className="text-sm font-semibold">{metrics.positionsCount}</span>
          </div>

          {/* Total Contracts */}
          <div className="flex flex-col gap-1 p-3 rounded-lg bg-background/50 backdrop-blur-sm border border-border/50">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Contracts</span>
            </div>
            <span className="text-sm font-semibold">{metrics.totalContracts}</span>
          </div>

          {/* Total Premium */}
          <div className="flex flex-col gap-1 p-3 rounded-lg bg-background/50 backdrop-blur-sm border border-border/50">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <DollarSign className="w-3.5 h-3.5" />
              <span>Total Premium</span>
            </div>
            <span className="text-sm font-semibold text-success">
              {formatCurrency(metrics.totalPremium)}
            </span>
          </div>
        </div>

        {/* Unrealized P/L Summary */}
        <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Unrealized P/L</span>
          <span className={`text-lg font-bold ${metrics.totalUnrealizedPnL >= 0 ? 'text-success' : 'text-destructive'}`}>
            {formatCurrency(metrics.totalUnrealizedPnL)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
