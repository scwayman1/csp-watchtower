import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, TrendingUp, TrendingDown, Minus, DollarSign, Percent, CheckCircle2, Circle, ArrowRight, Phone } from "lucide-react";
import { LearningAssignedPosition } from "@/hooks/useLearningAssignedPositions";
import { AssignedPositionRow } from "./AssignedPositionRow";

interface SimulatorAssignedZoneProps {
  assignedPositions: (LearningAssignedPosition & {
    currentPrice: number;
    dayChangePct?: number;
    marketValue: number;
    unrealizedPnL: number;
    coveredCallPremiums: number;
  })[];
  onSellCall: (position: any) => void;
  onSellShares: (position: any, sharesToSell: number, salePrice: number) => void;
}

export function SimulatorAssignedZone({ assignedPositions, onSellCall, onSellShares }: SimulatorAssignedZoneProps) {
  // Calculate zone metrics
  const metrics = useMemo(() => {
    const totalShares = assignedPositions.reduce((sum, ap) => sum + ap.shares, 0);
    const totalCostBasis = assignedPositions.reduce((sum, ap) => sum + ap.cost_basis, 0);
    const totalMarketValue = assignedPositions.reduce((sum, ap) => sum + ap.marketValue, 0);
    const totalPutPremiums = assignedPositions.reduce((sum, ap) => sum + (ap.original_put_premium || 0), 0);
    const totalCallPremiums = assignedPositions.reduce((sum, ap) => sum + ap.coveredCallPremiums, 0);
    const totalPremiums = totalPutPremiums + totalCallPremiums;
    const unrealizedPnL = totalMarketValue - totalCostBasis + totalPutPremiums;
    const netCostBasis = totalCostBasis - totalPremiums;
    
    // Calculate positions with active calls
    const positionsWithCalls = assignedPositions.filter(ap => 
      ap.covered_calls?.some(cc => cc.is_active)
    ).length;

    return {
      totalPositions: assignedPositions.length,
      totalShares,
      totalCostBasis,
      totalMarketValue,
      totalPutPremiums,
      totalCallPremiums,
      totalPremiums,
      unrealizedPnL,
      netCostBasis,
      positionsWithCalls,
    };
  }, [assignedPositions]);

  // Build wheel cycle steps for each position
  const getWheelSteps = (position: LearningAssignedPosition & { coveredCallPremiums: number }) => {
    const hasActiveCalls = position.covered_calls?.some(cc => cc.is_active);
    const hasClosedCalls = position.covered_calls?.some(cc => !cc.is_active);
    
    return [
      {
        label: "CSP Assigned",
        date: position.assignment_date,
        completed: true,
      },
      {
        label: "Covered Call",
        completed: hasActiveCalls || hasClosedCalls,
      },
      {
        label: "Called Away / Exit",
        completed: !position.is_active,
      },
    ];
  };

  if (assignedPositions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Zone Header with Gradient */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-background border border-amber-500/20 p-6">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl" />
        
        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <Package className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Assigned Positions Zone</h3>
              <p className="text-sm text-muted-foreground">Wheel Strategy - Managing {metrics.totalPositions} position{metrics.totalPositions !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mt-6">
            <div className="bg-card/50 backdrop-blur-sm rounded-lg p-3 border border-border/50">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Package className="h-3 w-3" />
                Total Shares
              </div>
              <p className="text-xl font-bold">{metrics.totalShares.toLocaleString()}</p>
            </div>
            
            <div className="bg-card/50 backdrop-blur-sm rounded-lg p-3 border border-border/50">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <DollarSign className="h-3 w-3" />
                Cost Basis
              </div>
              <p className="text-xl font-bold">${metrics.totalCostBasis.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
            
            {/* BREAK-EVEN CARD - Highlighted */}
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 backdrop-blur-sm rounded-lg p-3 border-2 border-primary/30 relative overflow-hidden">
              <div className="absolute -top-1 -right-1 px-2 py-0.5 bg-primary text-primary-foreground text-[10px] font-semibold rounded-bl-lg">
                KEY METRIC
              </div>
              <div className="flex items-center gap-2 text-xs text-primary mb-1">
                <TrendingUp className="h-3 w-3" />
                Break-Even Price
              </div>
              <p className="text-xl font-bold">${(metrics.netCostBasis / metrics.totalShares).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-muted-foreground mt-1">
                vs ${(metrics.totalMarketValue / metrics.totalShares).toFixed(2)} avg current
              </p>
            </div>
            
            <div className="bg-card/50 backdrop-blur-sm rounded-lg p-3 border border-border/50">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <TrendingUp className="h-3 w-3" />
                Market Value
              </div>
              <p className="text-xl font-bold">${metrics.totalMarketValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
            
            <div className="bg-card/50 backdrop-blur-sm rounded-lg p-3 border border-border/50">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <DollarSign className="h-3 w-3 text-success" />
                Total Premiums
              </div>
              <p className="text-xl font-bold text-success">+${metrics.totalPremiums.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Put: ${metrics.totalPutPremiums.toFixed(0)} · Call: ${metrics.totalCallPremiums.toFixed(0)}
              </p>
            </div>
            
            <div className="bg-card/50 backdrop-blur-sm rounded-lg p-3 border border-border/50">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Percent className="h-3 w-3" />
                Net Position P/L
              </div>
              <p className={`text-xl font-bold ${metrics.unrealizedPnL >= 0 ? 'text-success' : 'text-destructive'}`}>
                {metrics.unrealizedPnL >= 0 ? '+' : ''}${metrics.unrealizedPnL.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>

            {/* Break-Even Progress */}
            <div className="bg-card/50 backdrop-blur-sm rounded-lg p-3 border border-border/50">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Percent className="h-3 w-3" />
                Above Break-Even
              </div>
              {(() => {
                const breakEvenPerShare = metrics.netCostBasis / metrics.totalShares;
                const currentAvgPrice = metrics.totalMarketValue / metrics.totalShares;
                const pctAboveBreakEven = ((currentAvgPrice - breakEvenPerShare) / breakEvenPerShare) * 100;
                const isAbove = pctAboveBreakEven >= 0;
                return (
                  <>
                    <p className={`text-xl font-bold ${isAbove ? 'text-success' : 'text-destructive'}`}>
                      {isAbove ? '+' : ''}{pctAboveBreakEven.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {isAbove ? 'In profit zone' : 'Below break-even'}
                    </p>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Wheel Cycle Timelines */}
      <Card className="border-amber-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            Wheel Cycle Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {assignedPositions.map((position) => {
              const steps = getWheelSteps(position);
              return (
                <div key={position.id} className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
                  <div className="min-w-[80px]">
                    <Badge variant="outline" className="font-mono">
                      {position.symbol}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {position.shares} shares
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-1 overflow-x-auto py-2">
                    {steps.map((step, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="flex flex-col items-center min-w-[100px]">
                          <div className="flex items-center gap-2">
                            {step.completed ? (
                              <CheckCircle2 className="w-4 h-4 text-success" />
                            ) : (
                              <Circle className="w-4 h-4 text-muted-foreground" />
                            )}
                            <span className={`text-xs font-medium ${step.completed ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {step.label}
                            </span>
                          </div>
                          {step.date && (
                            <span className="text-xs text-muted-foreground mt-0.5">
                              {new Date(step.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                        {index < steps.length - 1 && (
                          <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Positions Table */}
      <Card className="border-amber-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            Position Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Shares</TableHead>
                  <TableHead>Current Price</TableHead>
                  <TableHead>Cost Basis</TableHead>
                  <TableHead className="bg-primary/5 border-x border-primary/20">
                    <div className="flex flex-col">
                      <span className="text-primary font-semibold">Break-Even</span>
                      <span className="text-xs text-muted-foreground font-normal">Net Cost / Share</span>
                    </div>
                  </TableHead>
                  <TableHead>Put Premium</TableHead>
                  <TableHead>Call Premiums</TableHead>
                  <TableHead>Net Position</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignedPositions.map((ap) => (
                  <AssignedPositionRow
                    key={ap.id}
                    position={ap}
                    onSellCall={onSellCall}
                    onSellShares={onSellShares}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
