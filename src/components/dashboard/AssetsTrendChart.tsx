import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { TrendingUp } from "lucide-react";

interface AssetsTrendChartProps {
  currentValue: number;
}

export function AssetsTrendChart({ currentValue }: AssetsTrendChartProps) {
  // Generate sample trend data for last 30 days
  // TODO: Replace with actual historical data from database
  const generateTrendData = () => {
    const data = [];
    const today = new Date();
    const baseValue = currentValue * 0.95; // Start 5% lower
    
    for (let i = 30; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      // Generate realistic looking trend with some variance
      const progress = (30 - i) / 30;
      const variance = (Math.random() - 0.5) * 0.02; // ±1% random variance
      const value = baseValue + (currentValue - baseValue) * progress + currentValue * variance;
      
      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: Math.round(value),
      });
    }
    
    return data;
  };

  const data = generateTrendData();
  const percentChange = ((currentValue - data[0].value) / data[0].value) * 100;

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
