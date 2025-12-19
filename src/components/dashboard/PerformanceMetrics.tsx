import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Award, 
  AlertCircle,
  DollarSign,
  Percent,
  BarChart3
} from "lucide-react";
import { 
  CartesianGrid, 
  XAxis, 
  YAxis, 
  ResponsiveContainer,
  Bar,
  BarChart,
  Cell,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Position } from "@/components/dashboard/PositionsTable";
import { PositionAnalysisTooltip } from "@/components/dashboard/PositionAnalysisTooltip";

interface PerformanceMetricsProps {
  positions: Position[];
}

export function PerformanceMetrics({ positions }: PerformanceMetricsProps) {
  // Calculate comprehensive metrics
  const totalPositions = positions.length;
  
  // Moneyness breakdown (industry standard for PUT options)
  // ITM: underlying < strike (pctAboveStrike < -1%)
  // ATM: underlying ≈ strike (within ±1%)
  // OTM: underlying > strike (pctAboveStrike > +1%)
  const itmPositions = positions.filter(p => p.pctAboveStrike < -1).length;
  const atmPositions = positions.filter(p => p.pctAboveStrike >= -1 && p.pctAboveStrike <= 1).length;
  const otmPositions = positions.filter(p => p.pctAboveStrike > 1).length;
  const otmPercentage = totalPositions > 0 ? (otmPositions / totalPositions) * 100 : 0;
  
  // Expiring soon
  const expiringSoon = positions.filter(p => p.daysToExp <= 7);
  const expiringSoonContracts = expiringSoon.reduce((sum, p) => sum + p.contracts, 0);
  
  const totalPremiumCollected = positions.reduce((sum, p) => sum + p.totalPremium, 0);
  const totalUnrealizedPnL = positions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
  const totalCapitalAtRisk = positions.reduce((sum, p) => sum + (p.strikePrice * 100 * p.contracts), 0);
  const returnOnCapital = totalCapitalAtRisk > 0 ? (totalPremiumCollected / totalCapitalAtRisk) * 100 : 0;
  
  const avgPremiumPerPosition = totalPositions > 0 ? totalPremiumCollected / totalPositions : 0;
  
  const bestPosition = positions.length > 0 
    ? positions.reduce((best, p) => p.unrealizedPnL > best.unrealizedPnL ? p : best)
    : null;
  
  const worstPosition = positions.length > 0
    ? positions.reduce((worst, p) => p.unrealizedPnL < worst.unrealizedPnL ? p : worst)
    : null;

  // Chart data - P/L by symbol (top 10)
  const pnlBySymbol = positions
    .map(p => ({
      symbol: p.symbol,
      pnl: p.unrealizedPnL,
      premium: p.totalPremium,
      roi: ((p.unrealizedPnL / p.totalPremium) * 100).toFixed(1)
    }))
    .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
    .slice(0, 10);

  if (totalPositions === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Performance Overview Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Moneyness</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{otmPercentage.toFixed(0)}% OTM</div>
            <p className="text-xs text-muted-foreground mt-1">
              {otmPositions} OTM • {atmPositions} ATM • {itmPositions} ITM
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Out-of-the-money positions favorable for expiration
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Return on Capital</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{returnOnCapital.toFixed(2)}%</div>
            <p className="text-xs text-muted-foreground mt-2">
              ${totalPremiumCollected.toLocaleString()} on ${totalCapitalAtRisk.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{expiringSoon.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {expiringSoonContracts} contracts expiring in 7 days
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Total premium: ${expiringSoon.reduce((sum, p) => sum + p.totalPremium, 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Unrealized P/L</CardTitle>
            {totalUnrealizedPnL >= 0 ? (
              <TrendingUp className="h-4 w-4 text-success" />
            ) : (
              <TrendingDown className="h-4 w-4 text-destructive" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalUnrealizedPnL >= 0 ? 'text-success' : 'text-destructive'}`}>
              ${totalUnrealizedPnL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {((totalUnrealizedPnL / totalPremiumCollected) * 100).toFixed(1)}% of premium
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Best/Worst Performers */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {bestPosition && (
          <PositionAnalysisTooltip position={bestPosition} variant="success">
            <Card className="cursor-pointer transition-all hover:ring-2 hover:ring-success/50 hover:shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-success" />
                  Best Performer
                  <Badge variant="outline" className="ml-auto text-xs">Hover for AI insights</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-lg">{bestPosition.symbol}</span>
                    <Badge variant="success" className="text-base">
                      +${bestPosition.unrealizedPnL.toFixed(2)}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Strike:</span>
                      <span className="ml-2 font-medium">${bestPosition.strikePrice}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Premium:</span>
                      <span className="ml-2 font-medium">${bestPosition.totalPremium}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">% Above:</span>
                      <span className="ml-2 font-medium">{bestPosition.pctAboveStrike.toFixed(1)}%</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">ROI:</span>
                      <span className="ml-2 font-medium text-success">
                        {((bestPosition.unrealizedPnL / bestPosition.totalPremium) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </PositionAnalysisTooltip>
        )}

        {worstPosition && (
          <PositionAnalysisTooltip position={worstPosition} variant="destructive">
            <Card className="cursor-pointer transition-all hover:ring-2 hover:ring-destructive/50 hover:shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  Needs Attention
                  <Badge variant="outline" className="ml-auto text-xs">Hover for AI insights</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-lg">{worstPosition.symbol}</span>
                    <Badge variant="destructive" className="text-base">
                      ${worstPosition.unrealizedPnL.toFixed(2)}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Strike:</span>
                      <span className="ml-2 font-medium">${worstPosition.strikePrice}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Premium:</span>
                      <span className="ml-2 font-medium">${worstPosition.totalPremium}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">% Above:</span>
                      <span className="ml-2 font-medium">{worstPosition.pctAboveStrike.toFixed(1)}%</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">ROI:</span>
                      <span className="ml-2 font-medium text-destructive">
                        {((worstPosition.unrealizedPnL / worstPosition.totalPremium) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </PositionAnalysisTooltip>
        )}
      </div>

      {/* P/L by Symbol Chart */}
      <Card>
        <CardHeader>
          <CardTitle>P/L by Symbol (Top 10)</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer 
            config={{ 
              pnl: { label: "Unrealized P/L", color: "hsl(var(--primary))" } 
            }} 
            className="h-[300px]"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pnlBySymbol}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="symbol" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {pnlBySymbol.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.pnl >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
