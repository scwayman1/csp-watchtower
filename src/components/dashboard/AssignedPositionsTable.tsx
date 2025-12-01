import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Plus, Shield, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { AssignedPosition } from "@/hooks/useAssignedPositions";
import { SellCallDialog } from "./SellCallDialog";
import { CoveredCallImportBar } from "./CoveredCallImportBar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AssignedPositionsTableProps {
  positions: AssignedPosition[];
  onRefetch: () => void;
}

export function AssignedPositionsTable({ positions, onRefetch }: AssignedPositionsTableProps) {
  const [selectedPosition, setSelectedPosition] = useState<{ id: string; symbol: string } | null>(null);
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
      {/* Bulk Import Bar */}
      <CoveredCallImportBar onSuccess={onRefetch} />
      
      <div className="overflow-x-auto border border-border rounded-lg">
        <Table className="min-w-[1000px]">
        <TableHeader>
          <TableRow>
            <TableHead>Symbol</TableHead>
            <TableHead>Shares</TableHead>
            <TableHead>Covered Call Status</TableHead>
            <TableHead>Assigned</TableHead>
            <TableHead>Assignment $</TableHead>
            <TableHead>Cost Basis</TableHead>
            <TableHead>Current $</TableHead>
            <TableHead>Unrealized P/L</TableHead>
            <TableHead>Put Premium</TableHead>
            <TableHead>Call Premiums</TableHead>
            <TableHead>Net Position</TableHead>
            <TableHead>Actions</TableHead>
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
              const hasCoveredCalls = activeCalls.length > 0;
              
              return (
                <TableRow key={position.id} className="hover:bg-muted/50">
                  <TableCell className="font-semibold">{position.symbol}</TableCell>
                  <TableCell>{position.shares.toLocaleString()}</TableCell>
                  <TableCell>
                    {hasCoveredCalls ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-2">
                              <Badge variant="success" className="gap-1">
                                <Shield className="h-3 w-3" />
                                {activeCalls.length} Active
                              </Badge>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            <div className="space-y-2">
                              <p className="font-semibold text-sm">Active Covered Calls:</p>
                              {activeCalls.map((call, idx) => {
                                const daysToExp = calculateDaysToExpiration(call.expiration);
                                return (
                                  <div key={call.id} className="text-xs space-y-1 pb-2 border-b border-border last:border-0 last:pb-0">
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Strike:</span>
                                      <span className="font-medium">{formatCurrency(call.strike_price)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Exp:</span>
                                      <span>{formatDate(call.expiration)} ({daysToExp}d)</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Premium:</span>
                                      <span className="text-success">+{formatCurrency(call.premium_per_contract * 100 * call.contracts)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Contracts:</span>
                                      <span>{call.contracts}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Uncovered
                      </Badge>
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
                  <TableCell className="text-success">
                    {position.total_call_premiums && position.total_call_premiums > 0 ? (
                      <div className="font-semibold">+{formatCurrency(position.total_call_premiums)}</div>
                    ) : (
                      <span className="text-muted-foreground">$0.00</span>
                    )}
                  </TableCell>
                  <TableCell className={position.net_position && position.net_position >= 0 ? "text-success font-bold" : "text-destructive font-bold"}>
                    {formatCurrency(position.net_position || 0)}
                  </TableCell>
                  <TableCell>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="gap-1"
                      onClick={() => setSelectedPosition({ id: position.id, symbol: position.symbol })}
                    >
                      <Plus className="h-3 w-3" />
                      Sell Call
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
      </div>

      <SellCallDialog
        open={!!selectedPosition}
        onOpenChange={(open) => !open && setSelectedPosition(null)}
        assignedPositionId={selectedPosition?.id || ""}
        symbol={selectedPosition?.symbol || ""}
        onSuccess={onRefetch}
      />
    </div>
  );
}
