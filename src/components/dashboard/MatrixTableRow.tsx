import { TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { Position } from "./PositionsTable";

interface MatrixTableRowProps {
  position: Position;
  onAnalyze: (position: Position) => void;
  onAssign: (position: Position) => void;
  formatCurrency: (value: number) => string;
  formatPercent: (value: number) => string;
  getPremiumColorClass: (positionId: string) => string;
}

export function MatrixTableRow({ 
  position, 
  onAnalyze, 
  onAssign,
  formatCurrency,
  formatPercent,
  getPremiumColorClass 
}: MatrixTableRowProps) {
  // Risk-based row coloring
  const getRiskBackgroundClass = () => {
    if (position.pctAboveStrike >= 10) return "bg-success/5 hover:bg-success/10";
    if (position.pctAboveStrike >= 5) return "bg-warning/5 hover:bg-warning/10";
    return "bg-destructive/5 hover:bg-destructive/10";
  };

  const getTrendIcon = () => {
    if (!position.dayChangePct) return <Minus className="w-3 h-3 text-muted-foreground" />;
    if (position.dayChangePct > 0) return <TrendingUp className="w-3 h-3 text-success" />;
    return <TrendingDown className="w-3 h-3 text-destructive" />;
  };

  const getRiskLevel = () => {
    if (position.pctAboveStrike >= 10) return { label: "Low", variant: "default" as const };
    if (position.pctAboveStrike >= 5) return { label: "Medium", variant: "secondary" as const };
    return { label: "High", variant: "destructive" as const };
  };

  const risk = getRiskLevel();

  return (
    <TableRow className={`transition-all border-b border-border/50 ${getRiskBackgroundClass()}`}>
      <TableCell className="font-semibold">
        <div className="flex flex-col">
          <span className="text-base">{position.symbol}</span>
          <span className="text-xs text-muted-foreground">
            {new Date(position.expiration).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      </TableCell>
      <TableCell className="font-mono">
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-sm">{formatCurrency(position.underlyingPrice)}</span>
          <div className="flex items-center gap-1">
            {getTrendIcon()}
            <span className={`text-xs ${position.dayChangePct && position.dayChangePct > 0 ? "text-success" : position.dayChangePct && position.dayChangePct < 0 ? "text-destructive" : "text-muted-foreground"}`}>
              {position.dayChangePct ? `${position.dayChangePct >= 0 ? '+' : ''}${position.dayChangePct.toFixed(1)}%` : '-'}
            </span>
          </div>
        </div>
      </TableCell>
      <TableCell className="font-mono text-sm font-semibold">
        {formatCurrency(position.strikePrice)}
      </TableCell>
      <TableCell className={getPremiumColorClass(position.id)}>
        {formatCurrency(position.premiumPerContract)}
      </TableCell>
      <TableCell className="text-sm font-medium">{position.daysToExp}</TableCell>
      <TableCell>
        <Badge variant={risk.variant} className="text-xs">{risk.label}</Badge>
      </TableCell>
      <TableCell className={position.unrealizedPnL >= 0 ? "text-success font-semibold" : "text-destructive font-semibold"}>
        {formatCurrency(position.unrealizedPnL)}
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onAnalyze(position)}>
            Analyze
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onAssign(position)}>
            Assign
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
