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
  Line, 
  LineChart, 
  XAxis, 
  YAxis, 
  ResponsiveContainer,
  Bar,
  BarChart,
  Area,
  AreaChart,
  Scatter,
  ScatterChart,
  ZAxis,
  Cell,
  Tooltip,
  Legend
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Position } from "@/components/dashboard/PositionsTable";

interface PerformanceMetricsProps {
  positions: Position[];
}

export function PerformanceMetrics({ positions }: PerformanceMetricsProps) {
  // Calculate comprehensive metrics
  const totalPositions = positions.length;
  const profitablePositions = positions.filter(p => p.unrealizedPnL > 0).length;
  const losingPositions = positions.filter(p => p.unrealizedPnL < 0).length;
  const winRate = totalPositions > 0 ? (profitablePositions / totalPositions) * 100 : 0;
  
  const totalPremiumCollected = positions.reduce((sum, p) => sum + p.totalPremium, 0);
  const totalUnrealizedPnL = positions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
  const totalCapitalAtRisk = positions.reduce((sum, p) => sum + (p.strikePrice * 100 * p.contracts), 0);
  const returnOnCapital = totalCapitalAtRisk > 0 ? (totalPremiumCollected / totalCapitalAtRisk) * 100 : 0;
  
  const avgPnLPerPosition = totalPositions > 0 ? totalUnrealizedPnL / totalPositions : 0;
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

  // Performance distribution by days to expiration
  interface DTEBucket {
    range: string;
    totalPnL: number;
    count: number;
    avgPnL: number;
  }

  const performanceByDTE = positions.reduce((acc, p) => {
    const dteRange = p.daysToExp < 7 ? "< 7 days" 
      : p.daysToExp < 30 ? "7-30 days"
      : p.daysToExp < 60 ? "30-60 days"
      : "> 60 days";
    
    if (!acc[dteRange]) {
      acc[dteRange] = { range: dteRange, totalPnL: 0, count: 0, avgPnL: 0 };
    }
    acc[dteRange].totalPnL += p.unrealizedPnL;
    acc[dteRange].count += 1;
    return acc;
  }, {} as Record<string, DTEBucket>);

  const dteChartData = Object.values(performanceByDTE).map(item => ({
    range: item.range,
    avgPnL: item.count > 0 ? item.totalPnL / item.count : 0,
    count: item.count
  }));

  // Risk/Return scatter data
  const riskReturnData = positions.map(p => ({
    symbol: p.symbol,
    risk: p.pctAboveStrike < 5 ? 10 : p.pctAboveStrike < 10 ? 5 : 1,
    return: (p.unrealizedPnL / p.totalPremium) * 100,
    size: p.totalPremium
  }));

  if (totalPositions === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Performance Overview Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{winRate.toFixed(1)}%</div>
            <Progress value={winRate} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {profitablePositions} profitable / {losingPositions} losing
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
            <CardTitle className="text-sm font-medium">Avg P/L per Position</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${avgPnLPerPosition >= 0 ? 'text-success' : 'text-destructive'}`}>
              ${avgPnLPerPosition.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Avg premium: ${avgPremiumPerPosition.toFixed(2)}
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-success" />
                Best Performer
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
        )}

        {worstPosition && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Needs Attention
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
        )}
      </div>

      {/* Charts Grid */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* P/L by Symbol */}
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

        {/* Performance by Days to Expiration */}
        <Card>
          <CardHeader>
            <CardTitle>Avg P/L by Days to Expiration</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer 
              config={{ 
                avgPnL: { label: "Avg P/L", color: "hsl(var(--primary))" } 
              }} 
              className="h-[300px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dteChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area 
                    type="monotone" 
                    dataKey="avgPnL" 
                    stroke="hsl(var(--primary))" 
                    fill="hsl(var(--primary) / 0.2)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
