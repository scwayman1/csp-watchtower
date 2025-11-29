import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { TrendingUp } from "lucide-react";
import { PortfolioSnapshot } from "@/hooks/usePortfolioHistory";

interface AssetsTrendChartProps {
  currentValue: number;
  history: PortfolioSnapshot[];
}

export function AssetsTrendChart({ currentValue, history }: AssetsTrendChartProps) {
  // Convert portfolio history to chart data
  const data = history.length > 0 
    ? history.map(snapshot => ({
        date: new Date(snapshot.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: snapshot.portfolio_value,
      }))
    : [{ date: 'Now', value: currentValue }]; // Fallback if no history

  const startValue = data.length > 0 ? data[0].value : currentValue;
  const percentChange = startValue > 0 ? ((currentValue - startValue) / startValue) * 100 : 0;

  return (
    <Card className="col-span-1 md:col-span-2 lg:col-span-3">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Total Assets Trend (30 Days)</CardTitle>
          <div className="flex items-center gap-2">
            <TrendingUp className={`h-4 w-4 ${percentChange >= 0 ? 'text-success' : 'text-destructive'}`} />
            <span className={`text-sm font-semibold ${percentChange >= 0 ? 'text-success' : 'text-destructive'}`}>
              {percentChange >= 0 ? '+' : ''}{percentChange.toFixed(2)}%
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={120}>
          <LineChart data={data}>
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 10 }}
              stroke="hsl(var(--muted-foreground))"
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              tickFormatter={(value, index) => {
                // Show only first, middle, and last labels
                if (index === 0 || index === Math.floor(data.length / 2) || index === data.length - 1) {
                  return value;
                }
                return '';
              }}
            />
            <YAxis 
              hide 
              domain={['dataMin - 10000', 'dataMax + 10000']}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value: number) => [`$${value.toLocaleString()}`, 'Assets']}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: 'hsl(var(--primary))' }}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>Starting: ${data[0].value.toLocaleString()}</span>
          <span>Current: ${currentValue.toLocaleString()}</span>
        </div>
      </CardContent>
    </Card>
  );
}
