import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown, Minus, Target } from "lucide-react";
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

  // Calculate aggregate break-even metrics
  const aggregateMetrics = positions.reduce((acc, pos) => {
    const totalCallPremiums = pos.total_call_premiums || 0;
    const totalPremiums = pos.original_put_premium + totalCallPremiums;
    const netCostBasis = (pos.cost_basis * pos.shares) - totalPremiums;
    const marketValue = (pos.current_price || pos.cost_basis) * pos.shares;
    
    return {
      totalCostBasis: acc.totalCostBasis + (pos.cost_basis * pos.shares),
      totalNetCostBasis: acc.totalNetCostBasis + netCostBasis,
      totalMarketValue: acc.totalMarketValue + marketValue,
      totalShares: acc.totalShares + pos.shares,
      totalPremiums: acc.totalPremiums + totalPremiums,
    };
  }, { totalCostBasis: 0, totalNetCostBasis: 0, totalMarketValue: 0, totalShares: 0, totalPremiums: 0 });

  const avgBreakEven = aggregateMetrics.totalNetCostBasis / aggregateMetrics.totalShares;
  const avgCurrentPrice = aggregateMetrics.totalMarketValue / aggregateMetrics.totalShares;
  const portfolioPctAboveBreakEven = ((aggregateMetrics.totalMarketValue - aggregateMetrics.totalNetCostBasis) / aggregateMetrics.totalNetCostBasis) * 100;
  const isPortfolioAboveBreakEven = portfolioPctAboveBreakEven >= 0;

  return (
    <div className="space-y-4">
      {/* Break-Even Summary Banner */}
      {positions.length > 0 && (
        <div className={`relative overflow-hidden rounded-xl p-4 border-2 ${
          isPortfolioAboveBreakEven 
            ? 'bg-gradient-to-r from-success/10 via-success/5 to-background border-success/30' 
            : 'bg-gradient-to-r from-destructive/10 via-destructive/5 to-background border-destructive/30'
        }`}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
          
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isPortfolioAboveBreakEven ? 'bg-success/20' : 'bg-destructive/20'}`}>
                <Target className={`h-5 w-5 ${isPortfolioAboveBreakEven ? 'text-success' : 'text-destructive'}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Portfolio Break-Even Analysis</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">
                    {formatCurrency(avgBreakEven)}
                  </span>
                  <span className="text-sm text-muted-foreground">avg break-even per share</span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Current Avg</p>
                <p className="text-lg font-semibold">{formatCurrency(avgCurrentPrice)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Total Premiums</p>
                <p className="text-lg font-semibold text-success">+{formatCurrency(aggregateMetrics.totalPremiums)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge variant={isPortfolioAboveBreakEven ? "default" : "destructive"} className="mt-1">
                  {isPortfolioAboveBreakEven ? '+' : ''}{portfolioPctAboveBreakEven.toFixed(1)}% {isPortfolioAboveBreakEven ? 'Above' : 'Below'}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto border border-border rounded-lg">
        <Table className="min-w-[1200px]">
        <TableHeader>
          <TableRow>
            <TableHead>Symbol</TableHead>
            <TableHead>Shares</TableHead>
            <TableHead>Call Strike</TableHead>
            <TableHead>Call Exp</TableHead>
            <TableHead>Call Premium</TableHead>
            <TableHead>Assigned</TableHead>
            <TableHead>Cost Basis</TableHead>
            <TableHead className="bg-primary/5 border-x border-primary/20">
              <div className="flex flex-col">
                <span className="text-primary font-semibold">Break-Even</span>
                <span className="text-xs text-muted-foreground font-normal">Net / Share</span>
              </div>
            </TableHead>
            <TableHead>Current $</TableHead>
            <TableHead>Premiums</TableHead>
            <TableHead>Net Position</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                No assigned positions yet. When your puts get assigned, they'll appear here.
              </TableCell>
            </TableRow>
          ) : (
            positions.map((position) => {
              const activeCalls = position.covered_calls?.filter(c => c.is_active) || [];
              const primaryCall = activeCalls[0];
              const hasMultipleCalls = activeCalls.length > 1;
              
              // Calculate break-even metrics for this position
              const totalCallPremiums = position.total_call_premiums || 0;
              const totalPremiums = position.original_put_premium + totalCallPremiums;
              const netCostBasis = (position.cost_basis * position.shares) - totalPremiums;
              const breakEvenPerShare = netCostBasis / position.shares;
              const currentPrice = position.current_price || position.cost_basis;
              const pctAboveBreakEven = ((currentPrice - breakEvenPerShare) / breakEvenPerShare) * 100;
              const isAboveBreakEven = currentPrice >= breakEvenPerShare;
              
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
                            +{activeCalls.length - 1}
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
                      <span className="text-success font-medium">
                        +{formatCurrency(primaryCall.premium_per_contract * 100 * primaryCall.contracts)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm">{formatDate(position.assignment_date)}</span>
                      <span className="text-xs text-muted-foreground">
                        @ {formatCurrency(position.assignment_price)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{formatCurrency(position.cost_basis)}</span>
                      <span className="text-xs text-muted-foreground">
                        Total: {formatCurrency(position.cost_basis * position.shares)}
                      </span>
                    </div>
                  </TableCell>
                  {/* BREAK-EVEN COLUMN - Highlighted */}
                  <TableCell className={`bg-gradient-to-r ${isAboveBreakEven ? 'from-success/10 to-success/5' : 'from-destructive/10 to-destructive/5'} border-x ${isAboveBreakEven ? 'border-success/20' : 'border-destructive/20'}`}>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-bold ${isAboveBreakEven ? 'text-success' : 'text-destructive'}`}>
                          {formatCurrency(breakEvenPerShare)}
                        </span>
                        {isAboveBreakEven ? (
                          <TrendingUp className="w-3.5 h-3.5 text-success" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5 text-destructive" />
                        )}
                      </div>
                      <div className={`text-xs font-medium ${isAboveBreakEven ? 'text-success' : 'text-destructive'}`}>
                        {isAboveBreakEven ? '+' : ''}{pctAboveBreakEven.toFixed(1)}% {isAboveBreakEven ? 'above' : 'below'}
                      </div>
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${isAboveBreakEven ? 'bg-success' : 'bg-destructive'}`}
                          style={{ width: `${Math.min(Math.abs(pctAboveBreakEven) * 5, 100)}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <a 
                        href={`https://finance.yahoo.com/quote/${position.symbol}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium cursor-pointer hover:text-primary transition-colors"
                      >
                        {formatCurrency(currentPrice)}
                      </a>
                      <div className="flex items-center gap-1 text-xs">
                        {getTrendIcon(position.day_change_pct)}
                        <span className={position.day_change_pct && position.day_change_pct > 0 ? "text-success" : position.day_change_pct && position.day_change_pct < 0 ? "text-destructive" : "text-muted-foreground"}>
                          {position.day_change_pct ? `${position.day_change_pct >= 0 ? '+' : ''}${position.day_change_pct.toFixed(1)}%` : '-'}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="text-success font-medium">
                        +{formatCurrency(totalPremiums)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Put: {formatCurrency(position.original_put_premium)}
                      </span>
                      {totalCallPremiums > 0 && (
                        <span className="text-xs text-muted-foreground">
                          Calls: {formatCurrency(totalCallPremiums)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className={position.net_position && position.net_position >= 0 ? "text-success font-bold" : "text-destructive font-bold"}>
                    <div className="flex flex-col gap-1">
                      <span>{formatCurrency(position.net_position || 0)}</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        Total P/L
                      </span>
                    </div>
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
