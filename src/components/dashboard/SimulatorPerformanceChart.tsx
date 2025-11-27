import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format } from "date-fns";
import { PortfolioSnapshot } from "@/hooks/useSimulatorPortfolioHistory";
import { TrendingUp, TrendingDown } from "lucide-react";

interface SimulatorPerformanceChartProps {
  history: PortfolioSnapshot[];
  startingCapital: number;
}

export const SimulatorPerformanceChart = ({ history, startingCapital }: SimulatorPerformanceChartProps) => {
  // Prepare chart data with starting point
  const chartData = [
    {
      date: history.length > 0 ? new Date(history[0].created_at).getTime() - 86400000 : Date.now(),
      portfolioValue: startingCapital,
      cashBalance: startingCapital,
      positionsValue: 0,
      assignedSharesValue: 0,
      premiumsCollected: 0,
      label: "Start",
    },
    ...history.map((snapshot) => ({
      date: new Date(snapshot.created_at).getTime(),
      portfolioValue: Number(snapshot.portfolio_value),
      cashBalance: Number(snapshot.cash_balance),
      positionsValue: Number(snapshot.positions_value),
      assignedSharesValue: Number(snapshot.assigned_shares_value),
      premiumsCollected: Number(snapshot.total_premiums_collected),
      label: snapshot.event_description || snapshot.event_type,
    })),
  ];

  const latestValue = chartData.length > 0 ? chartData[chartData.length - 1].portfolioValue : startingCapital;
  const totalReturn = latestValue - startingCapital;
  const returnPct = startingCapital > 0 ? ((totalReturn / startingCapital) * 100) : 0;
  const isPositive = totalReturn >= 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm text-muted-foreground mb-2">
            {format(new Date(label), "MMM d, yyyy h:mm a")}
          </p>
          <p className="text-xs text-muted-foreground mb-1">{data.label}</p>
          <div className="space-y-1">
            <p className="text-sm font-medium">
              Portfolio: {formatCurrency(data.portfolioValue)}
            </p>
            <p className="text-xs text-muted-foreground">
              Cash: {formatCurrency(data.cashBalance)}
            </p>
            <p className="text-xs text-muted-foreground">
              Positions: {formatCurrency(data.positionsValue)}
            </p>
            <p className="text-xs text-muted-foreground">
              Assigned: {formatCurrency(data.assignedSharesValue)}
            </p>
            <p className="text-xs text-success">
              Premiums: {formatCurrency(data.premiumsCollected)}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Portfolio Performance</CardTitle>
          <div className="flex items-center gap-2">
            {isPositive ? (
              <TrendingUp className="h-5 w-5 text-success" />
            ) : (
              <TrendingDown className="h-5 w-5 text-destructive" />
            )}
            <span className={`text-lg font-bold ${isPositive ? 'text-success' : 'text-destructive'}`}>
              {isPositive ? '+' : ''}{formatCurrency(totalReturn)} ({returnPct.toFixed(2)}%)
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            <p>No history yet. Open positions to start tracking performance.</p>
          </div>
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPortfolio" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorPremiums" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => format(new Date(value), "MMM d")}
                  className="text-muted-foreground"
                  fontSize={12}
                />
                <YAxis
                  tickFormatter={(value) => formatCurrency(value)}
                  className="text-muted-foreground"
                  fontSize={12}
                  width={80}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="portfolioValue"
                  name="Portfolio Value"
                  stroke="hsl(var(--primary))"
                  fillOpacity={1}
                  fill="url(#colorPortfolio)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="premiumsCollected"
                  name="Total Premiums"
                  stroke="hsl(var(--success))"
                  fillOpacity={1}
                  fill="url(#colorPremiums)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
