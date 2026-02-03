import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown, Minus, DollarSign } from "lucide-react";
import type { AssignedPosition } from "@/hooks/useAssignedPositions";

interface AssignedPositionsTableProps {
  positions: AssignedPosition[];
  onRefetch: () => void;
}

export function AssignedPositionsTable({ positions, onRefetch }: AssignedPositionsTableProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  const today = new Date().toISOString().split('T')[0];

  const isCallTrulyActive = (call: { is_active: boolean; expiration?: string | null }) => {
    const exp = call.expiration || "";
    // active = is_active AND not expired (handles stale is_active flags)
    return Boolean(call.is_active && exp && exp >= today);
  };

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

  // Calculate active covered call premium (only active calls, not expired/closed)
  const totalActiveCoveredCallPremium = positions.reduce((acc, pos) => {
    const activeCalls = pos.covered_calls?.filter(isCallTrulyActive) || [];
    const activeCallPremium = activeCalls.reduce((sum, call) => 
      sum + (call.premium_per_contract * 100 * call.contracts), 0);
    return acc + activeCallPremium;
  }, 0);

  const activeCallCount = positions.reduce((acc, pos) => {
    const activeCalls = pos.covered_calls?.filter(isCallTrulyActive) || [];
    return acc + activeCalls.reduce((sum, call) => sum + call.contracts, 0);
  }, 0);

  const positionsWithActiveCalls = positions.filter(pos => 
    pos.covered_calls?.some(isCallTrulyActive)
  ).length;

  return (
    <div className="space-y-4">
      {/* Active Covered Call Premium Banner */}
      {positions.length > 0 && (
        <div className="relative overflow-hidden rounded-xl p-6 border-2 bg-gradient-to-r from-success/10 via-success/5 to-background border-success/30">
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />
          
          <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            {/* Left side - Main premium info */}
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-success/20">
                <DollarSign className="h-6 w-6 text-success" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Active Covered Call Premium</p>
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold tracking-tight text-success">
                    +{formatCurrency(totalActiveCoveredCallPremium)}
                  </span>
                  <span className="text-sm text-muted-foreground">from open covered calls</span>
                </div>
              </div>
            </div>
            
            {/* Right side - Stats grid */}
            <div className="flex flex-wrap gap-8">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Active Contracts</p>
                <p className="text-xl font-semibold">{activeCallCount}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Positions w/ Calls</p>
                <p className="text-xl font-semibold">{positionsWithActiveCalls}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Avg / Contract</p>
                <p className="text-xl font-semibold text-success">
                  +{formatCurrency(activeCallCount > 0 ? totalActiveCoveredCallPremium / activeCallCount : 0)}
                </p>
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
              const activeCalls = position.covered_calls?.filter(isCallTrulyActive) || [];
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
                  <TableCell className={`bg-gradient-to-r ${isAboveBreakEven ? 'from-success/10 to-success/5' : 'from-destructive/10 to-destructive/5'} border-x ${isAboveBreakEven ? 'border-success/20' : 'border-destructive/20'} py-4 px-4`}>
                    <div className="flex flex-col gap-2 min-w-[120px]">
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-bold ${isAboveBreakEven ? 'text-success' : 'text-destructive'}`}>
                          {formatCurrency(breakEvenPerShare)}
                        </span>
                        {isAboveBreakEven ? (
                          <TrendingUp className="w-4 h-4 text-success" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-destructive" />
                        )}
                      </div>
                      <div className={`text-sm font-medium ${isAboveBreakEven ? 'text-success' : 'text-destructive'}`}>
                        {isAboveBreakEven ? '+' : ''}{pctAboveBreakEven.toFixed(1)}% {isAboveBreakEven ? 'above' : 'below'}
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden mt-1">
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
