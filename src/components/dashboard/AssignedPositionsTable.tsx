import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { AssignedPosition } from "@/hooks/useAssignedPositions";

interface AssignedPositionsTableProps {
  positions: AssignedPosition[];
  onRefetch: () => void;
}

export function AssignedPositionsTable({ positions, onRefetch }: AssignedPositionsTableProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    const [year, month, day] = dateString.split("-");
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const calculateDaysToExpiration = (expirationDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [year, month, day] = expirationDate.split("-");
    const expDate = new Date(Number(year), Number(month) - 1, Number(day));
    const diffTime = expDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getTrendIcon = (dayChangePct?: number) => {
    if (!dayChangePct) return <Minus className="w-3 h-3 text-muted-foreground" />;
    if (dayChangePct > 0) return <TrendingUp className="w-3 h-3 text-success" />;
    return <TrendingDown className="w-3 h-3 text-destructive" />;
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto border border-border rounded-lg">
        <Table className="min-w-[1200px]">
        <TableHeader>
          <TableRow>
            <TableHead>Symbol</TableHead>
            <TableHead>Shares</TableHead>
            <TableHead>Call Strike</TableHead>
            <TableHead>Call Expiration</TableHead>
            <TableHead>Call Premium</TableHead>
            <TableHead>Assigned</TableHead>
            <TableHead>Assignment $</TableHead>
            <TableHead>Cost Basis</TableHead>
            <TableHead>Current $</TableHead>
            <TableHead>Unrealized P/L</TableHead>
            <TableHead>Put Premium</TableHead>
            <TableHead>Net Position</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                No assigned positions yet. When your puts get assigned, they'll appear here.
              </TableCell>
            </TableRow>
          ) : (
            positions.map((position) => {
              const activeCalls = position.covered_calls?.filter(c => c.is_active) || [];
              const primaryCall = activeCalls[0];
              const hasMultipleCalls = activeCalls.length > 1;
              
              return (
                <TableRow key={position.id} className="hover:bg-muted/50">
                  <TableCell className="font-semibold">{position.symbol}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{position.shares.toLocaleString()}</span>
                      {primaryCall && (
                        <span className="text-xs text-muted-foreground">
                          {primaryCall.contracts * 100} covered
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {primaryCall ? (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatCurrency(primaryCall.strike_price)}</span>
                        {hasMultipleCalls && (
                          <Badge variant="outline" className="text-xs">
                            +{activeCalls.length - 1} more
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {primaryCall ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-sm">{formatDate(primaryCall.expiration)}</span>
                        <span className="text-xs text-muted-foreground">
                          {calculateDaysToExpiration(primaryCall.expiration)}d
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {primaryCall ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-success font-medium">
                          +{formatCurrency(primaryCall.premium_per_contract * 100 * primaryCall.contracts)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {primaryCall.contracts} ct × {formatCurrency(primaryCall.premium_per_contract * 100)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(position.assignment_date)}</TableCell>
                  <TableCell>{formatCurrency(position.assignment_price)}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(position.cost_basis)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <a 
                        href={`https://finance.yahoo.com/quote/${position.symbol}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium cursor-pointer hover:text-primary transition-colors"
                      >
                        {formatCurrency(position.current_price || 0)}
                      </a>
                      <div className="flex items-center gap-1 text-xs">
                        {getTrendIcon(position.day_change_pct)}
                        <span className={position.day_change_pct && position.day_change_pct > 0 ? "text-success" : position.day_change_pct && position.day_change_pct < 0 ? "text-destructive" : "text-muted-foreground"}>
                          {position.day_change_pct ? `${position.day_change_pct >= 0 ? '+' : ''}${position.day_change_pct.toFixed(1)}%` : '-'}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className={position.unrealized_pnl && position.unrealized_pnl >= 0 ? "text-success font-semibold" : "text-destructive font-semibold"}>
                    {formatCurrency(position.unrealized_pnl || 0)}
                  </TableCell>
                  <TableCell className="text-success">
                    +{formatCurrency(position.original_put_premium)}
                  </TableCell>
                  <TableCell className={position.net_position && position.net_position >= 0 ? "text-success font-bold" : "text-destructive font-bold"}>
                    {formatCurrency(position.net_position || 0)}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}
