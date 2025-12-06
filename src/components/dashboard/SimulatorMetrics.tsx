import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PortfolioSnapshot } from "@/hooks/useSimulatorPortfolioHistory";
import { TrendingUp, TrendingDown, Calendar, Percent, DollarSign, Target, BarChart3 } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip } from "recharts";

interface PositionForMetrics {
  id: string;
  symbol: string;
  contracts: number;
  premium_per_contract: number;
  created_at: string;
  is_active: boolean;
}

interface SimulatorMetricsProps {
  history: PortfolioSnapshot[];
  startingCapital: number;
  totalPremiums: number;
  totalCashSecured: number;
  totalAssignedCostBasis: number;
  totalPortfolioValue: number;
  // Current calculated values for display
  currentPortfolioValue: number;
  currentTotalPremiums: number;
  // Position data for accurate monthly calculations
  allPositions: PositionForMetrics[];
  expiredPositions: PositionForMetrics[];
}

interface MonthlyPerformance {
  month: string;
  monthLabel: string;
  premiumsCollected: number;
  portfolioValue: number;
  returnPct: number;
  trades: number;
}

export const SimulatorMetrics = ({
  history,
  startingCapital,
  totalPremiums,
  totalCashSecured,
  totalAssignedCostBasis,
  totalPortfolioValue,
  currentPortfolioValue,
  currentTotalPremiums,
  allPositions,
  expiredPositions,
}: SimulatorMetricsProps) => {
  // Calculate days active from first position
  const daysActive = useMemo(() => {
    if (history.length === 0) return 0;
    const firstDate = new Date(history[0].created_at);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - firstDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1; // Minimum 1 day
  }, [history]);

  // Calculate capital at risk (cash secured + assigned cost basis)
  const capitalAtRisk = totalCashSecured + totalAssignedCostBasis;

  // Calculate Annualized ROC
  // Formula: (Total Premium / Capital at Risk) * (365 / Days Active)
  const annualizedROC = useMemo(() => {
    if (capitalAtRisk <= 0 || daysActive <= 0) return 0;
    const roc = (totalPremiums / capitalAtRisk) * 100;
    const annualized = roc * (365 / daysActive);
    return annualized;
  }, [totalPremiums, capitalAtRisk, daysActive]);

  // Calculate absolute ROC (non-annualized)
  const absoluteROC = useMemo(() => {
    if (capitalAtRisk <= 0) return 0;
    return (totalPremiums / capitalAtRisk) * 100;
  }, [totalPremiums, capitalAtRisk]);

  // Calculate total return on starting capital - use current calculated values, not snapshot history
  const totalReturn = currentPortfolioValue - startingCapital;
  const totalReturnPct = startingCapital > 0 ? (totalReturn / startingCapital) * 100 : 0;

  // Calculate month-over-month performance from ACTUAL position data
  const monthlyPerformance = useMemo<MonthlyPerformance[]>(() => {
    // Combine all positions (active + expired) for monthly premium calculation
    const combinedPositions = [...allPositions, ...expiredPositions];
    
    if (combinedPositions.length === 0) return [];

    const monthlyData: Record<string, { 
      premiums: number;
      trades: number;
    }> = {};

    // Group positions by their creation month and sum premiums
    combinedPositions.forEach((pos) => {
      const date = new Date(pos.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      const positionPremium = pos.premium_per_contract * 100 * pos.contracts;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          premiums: 0,
          trades: 0,
        };
      }
      
      monthlyData[monthKey].premiums += positionPremium;
      monthlyData[monthKey].trades++;
    });

    // Convert to array with proper month labels
    const months = Object.keys(monthlyData).sort();
    let cumulativePremiums = 0;
    
    return months.map((monthKey, idx) => {
      const [year, month] = monthKey.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1);
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      
      const data = monthlyData[monthKey];
      cumulativePremiums += data.premiums;
      
      // Calculate portfolio value at end of month (starting + cumulative premiums)
      const portfolioValue = startingCapital + cumulativePremiums;
      
      // Calculate return for this month
      const prevPortfolioValue = idx === 0 ? startingCapital : startingCapital + (cumulativePremiums - data.premiums);
      const returnPct = prevPortfolioValue > 0 
        ? ((portfolioValue - prevPortfolioValue) / prevPortfolioValue) * 100 
        : 0;
      
      return {
        month: monthKey,
        monthLabel,
        premiumsCollected: data.premiums,
        portfolioValue,
        returnPct,
        trades: data.trades,
      };
    });
  }, [allPositions, expiredPositions, startingCapital]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as MonthlyPerformance;
      return (
        <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-foreground">{data.monthLabel}</p>
          <div className="space-y-1 mt-2 text-sm">
            <p className="text-success">Premium: {formatCurrency(data.premiumsCollected)}</p>
            <p className="text-muted-foreground">Portfolio: {formatCurrency(data.portfolioValue)}</p>
            <p className={data.returnPct >= 0 ? "text-success" : "text-destructive"}>
              Return: {data.returnPct >= 0 ? '+' : ''}{data.returnPct.toFixed(2)}%
            </p>
            <p className="text-muted-foreground">Trades: {data.trades}</p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Annualized ROC - The Key Metric */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-5 w-5 text-primary" />
              <p className="text-sm font-medium text-muted-foreground">Annualized ROC</p>
            </div>
            <p className={`text-3xl font-bold ${annualizedROC >= 0 ? 'text-success' : 'text-destructive'}`}>
              {annualizedROC.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {absoluteROC.toFixed(2)}% actual over {daysActive} days
            </p>
          </CardContent>
        </Card>

        {/* Capital at Risk */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-5 w-5 text-warning" />
              <p className="text-sm font-medium text-muted-foreground">Capital at Risk</p>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(capitalAtRisk)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {startingCapital > 0 ? ((capitalAtRisk / startingCapital) * 100).toFixed(1) : 0}% of capital deployed
            </p>
          </CardContent>
        </Card>

        {/* Total Return */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              {totalReturn >= 0 ? (
                <TrendingUp className="h-5 w-5 text-success" />
              ) : (
                <TrendingDown className="h-5 w-5 text-destructive" />
              )}
              <p className="text-sm font-medium text-muted-foreground">Total Return</p>
            </div>
            <p className={`text-2xl font-bold ${totalReturn >= 0 ? 'text-success' : 'text-destructive'}`}>
              {totalReturn >= 0 ? '+' : ''}{formatCurrency(totalReturn)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {totalReturnPct >= 0 ? '+' : ''}{totalReturnPct.toFixed(2)}% on {formatCurrency(startingCapital)}
            </p>
          </CardContent>
        </Card>

        {/* Days Active */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">Days Active</p>
            </div>
            <p className="text-2xl font-bold">{daysActive}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {history.length} events recorded
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Month over Month Performance */}
      {monthlyPerformance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Month-over-Month Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Monthly Premiums Chart */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-4">Monthly Premiums Collected</p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyPerformance}>
                      <XAxis 
                        dataKey="monthLabel" 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                      />
                      <YAxis 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                        tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="premiumsCollected" radius={[4, 4, 0, 0]}>
                        {monthlyPerformance.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`}
                            fill={entry.premiumsCollected >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Monthly Return Chart */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-4">Monthly Return %</p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyPerformance}>
                      <XAxis 
                        dataKey="monthLabel" 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                      />
                      <YAxis 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                        tickFormatter={(value) => `${value.toFixed(1)}%`}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="returnPct" radius={[4, 4, 0, 0]}>
                        {monthlyPerformance.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`}
                            fill={entry.returnPct >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Monthly Summary Table */}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-muted-foreground font-medium">Month</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Premiums</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Portfolio Value</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Return</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Trades</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyPerformance.map((month) => (
                    <tr key={month.month} className="border-b border-border/50">
                      <td className="py-2 font-medium">{month.monthLabel}</td>
                      <td className="py-2 text-right text-success">{formatCurrency(month.premiumsCollected)}</td>
                      <td className="py-2 text-right">{formatCurrency(month.portfolioValue)}</td>
                      <td className="py-2 text-right">
                        <Badge 
                          variant="outline"
                          className={month.returnPct >= 0 ? "border-success text-success" : "border-destructive text-destructive"}
                        >
                          {month.returnPct >= 0 ? '+' : ''}{month.returnPct.toFixed(2)}%
                        </Badge>
                      </td>
                      <td className="py-2 text-right text-muted-foreground">{month.trades}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ROC Explanation Card */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Percent className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium mb-2">Understanding Annualized ROC</p>
              <p className="text-sm text-muted-foreground">
                <strong>Return on Capital (ROC)</strong> measures how efficiently your capital generates income.
                The formula is: <code className="bg-muted px-1 rounded">(Total Premium ÷ Capital at Risk) × (365 ÷ Days Active)</code>
              </p>
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Total Premium</p>
                  <p className="font-semibold text-success">{formatCurrency(totalPremiums)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Capital at Risk</p>
                  <p className="font-semibold">{formatCurrency(capitalAtRisk)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Days Active</p>
                  <p className="font-semibold">{daysActive}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Annualized</p>
                  <p className="font-semibold text-primary">{annualizedROC.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
