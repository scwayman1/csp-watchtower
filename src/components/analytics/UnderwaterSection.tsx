import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, TrendingDown, DollarSign, Clock, Percent, Shield, HelpCircle } from "lucide-react";
import type { UnderwaterPosition, RecoveredPosition } from "@/hooks/useAssignedAnalytics";

interface UnderwaterSectionProps {
  underwaterPositions: UnderwaterPosition[];
  totalExposure: number;
  totalPremiumCollected: number;
  avgBreakEvenProgress: number;
  recoveredPositions: RecoveredPosition[];
  avgRecoveryDays: number;
  recoveryRate: number;
}

export function UnderwaterSection({
  underwaterPositions,
  totalExposure,
  totalPremiumCollected,
  avgBreakEvenProgress,
  recoveredPositions,
  avgRecoveryDays,
  recoveryRate,
}: UnderwaterSectionProps) {
  const formatCurrency = (value: number) =>
    `$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-6">
      {/* Current Exposure Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="border-l-4 border-l-destructive cursor-help hover:bg-muted/30 transition-colors">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Underwater Positions
                  <HelpCircle className="h-3 w-3 ml-auto opacity-50" />
                </CardDescription>
                <CardTitle className="text-2xl">{underwaterPositions.length}</CardTitle>
              </CardHeader>
            </Card>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="font-medium mb-1">Underwater Positions</p>
            <p className="text-xs text-muted-foreground">
              Positions where the current market price is below your cost basis (assignment price). 
              These represent unrealized losses that may recover over time.
            </p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="border-l-4 border-l-destructive cursor-help hover:bg-muted/30 transition-colors">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <TrendingDown className="h-3.5 w-3.5" />
                  Total Unrealized Loss
                  <HelpCircle className="h-3 w-3 ml-auto opacity-50" />
                </CardDescription>
                <CardTitle className="text-2xl text-destructive">
                  -{formatCurrency(totalExposure)}
                </CardTitle>
              </CardHeader>
            </Card>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="font-medium mb-1">Total Unrealized Loss</p>
            <p className="text-xs text-muted-foreground">
              Sum of (Cost Basis - Current Price) × Shares for all underwater positions. 
              This is paper loss only—not realized until you sell.
            </p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="border-l-4 border-l-chart-2 cursor-help hover:bg-muted/30 transition-colors">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  Premium Collected
                  <HelpCircle className="h-3 w-3 ml-auto opacity-50" />
                </CardDescription>
                <CardTitle className="text-2xl text-success">
                  +{formatCurrency(totalPremiumCollected)}
                </CardTitle>
                <p className="text-xs text-muted-foreground">While holding underwater</p>
              </CardHeader>
            </Card>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="font-medium mb-1">Premium Collected</p>
            <p className="text-xs text-muted-foreground">
              Total covered call premium earned while holding these underwater positions. 
              This income offsets your unrealized losses and accelerates break-even.
            </p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="border-l-4 border-l-amber-500 cursor-help hover:bg-muted/30 transition-colors">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <Percent className="h-3.5 w-3.5" />
                  Avg Break-Even Progress
                  <HelpCircle className="h-3 w-3 ml-auto opacity-50" />
                </CardDescription>
                <CardTitle className="text-2xl">{avgBreakEvenProgress.toFixed(0)}%</CardTitle>
                <Progress value={avgBreakEvenProgress} className="mt-2 h-2" />
              </CardHeader>
            </Card>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="font-medium mb-1">Break-Even Progress</p>
            <p className="text-xs text-muted-foreground">
              How much of the unrealized loss has been offset by collected premiums. 
              At 100%, premiums fully cover the paper loss. Formula: (Premium Collected ÷ Unrealized Loss) × 100
            </p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Underwater Positions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-destructive" />
            Current Underwater Positions
          </CardTitle>
          <CardDescription>Positions where current price is below cost basis</CardDescription>
        </CardHeader>
        <CardContent>
          {underwaterPositions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
              <Shield className="h-8 w-8 text-success" />
              <p>No underwater positions! All holdings are profitable.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Symbol</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Shares</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Cost Basis</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Current</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Unrealized</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Premium</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Break-Even</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {underwaterPositions.map((pos) => (
                    <tr key={pos.id} className="border-b border-border/50 hover:bg-muted/50">
                      <td className="py-3 px-2 font-medium">{pos.symbol}</td>
                      <td className="py-3 px-2 text-right">{pos.shares}</td>
                      <td className="py-3 px-2 text-right">${pos.costBasis.toFixed(2)}</td>
                      <td className="py-3 px-2 text-right">${pos.currentPrice.toFixed(2)}</td>
                      <td className="py-3 px-2 text-right text-destructive">
                        -{formatCurrency(pos.unrealizedLoss)}
                      </td>
                      <td className="py-3 px-2 text-right text-success">
                        +{formatCurrency(pos.premiumCollected)}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <Progress value={pos.breakEvenProgress} className="w-16 h-2" />
                          <span className="text-xs w-10">{pos.breakEvenProgress.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right text-muted-foreground">{pos.daysUnderwater}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historical Patterns */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recovery Patterns
          </CardTitle>
          <CardDescription>Historical analysis of underwater positions that recovered</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center p-4 rounded-lg bg-muted/50 cursor-help hover:bg-muted/70 transition-colors">
                  <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
                    Recovery Rate
                    <HelpCircle className="h-3 w-3 opacity-50" />
                  </p>
                  <p className="text-3xl font-bold text-success">{recoveryRate.toFixed(0)}%</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {recoveredPositions.length} of {recoveredPositions.length + underwaterPositions.length} positions recovered
                  </p>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="font-medium mb-1">Recovery Rate</p>
                <p className="text-xs text-muted-foreground">
                  Percentage of historically underwater positions that eventually recovered 
                  (were called away at a profit or returned to profitability). 
                  Higher rates indicate resilient stock selection.
                </p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center p-4 rounded-lg bg-muted/50 cursor-help hover:bg-muted/70 transition-colors">
                  <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
                    Avg Recovery Time
                    <HelpCircle className="h-3 w-3 opacity-50" />
                  </p>
                  <p className="text-3xl font-bold">{Math.round(avgRecoveryDays)}</p>
                  <p className="text-xs text-muted-foreground mt-1">days to recovery</p>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="font-medium mb-1">Average Recovery Time</p>
                <p className="text-xs text-muted-foreground">
                  Mean number of days from assignment to when the position was called away 
                  or returned to profitability. Use this to set expectations for current underwater holdings.
                </p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center p-4 rounded-lg bg-muted/50 cursor-help hover:bg-muted/70 transition-colors">
                  <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
                    Premium During Recovery
                    <HelpCircle className="h-3 w-3 opacity-50" />
                  </p>
                  <p className="text-3xl font-bold text-success">
                    {formatCurrency(recoveredPositions.reduce((s, p) => s + p.totalPremiumDuringRecovery, 0))}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">collected while waiting</p>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="font-medium mb-1">Premium During Recovery</p>
                <p className="text-xs text-muted-foreground">
                  Total covered call premium collected from positions while they were recovering. 
                  This demonstrates the wheel strategy's ability to generate income even during drawdowns.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>

          {recoveredPositions.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-medium mb-3">Recently Recovered</h4>
              <div className="flex flex-wrap gap-2">
                {recoveredPositions.slice(0, 10).map((pos) => (
                  <Tooltip key={pos.id}>
                    <TooltipTrigger asChild>
                      <Badge 
                        variant="outline" 
                        className="text-success border-success/30 cursor-help hover:bg-success/10 transition-colors"
                      >
                        {pos.symbol} • {pos.recoveryDays}d • +{formatCurrency(pos.totalPremiumDuringRecovery)}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="font-medium mb-1">{pos.symbol} Recovery</p>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>• Shares: {pos.shares}</p>
                        <p>• Days to recover: {pos.recoveryDays}</p>
                        <p>• Premium earned: +{formatCurrency(pos.totalPremiumDuringRecovery)}</p>
                        <p>• Outcome: {pos.wasCalledAway ? "Called away at profit" : "Recovered to profitability"}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
