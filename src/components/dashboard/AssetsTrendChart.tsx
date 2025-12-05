import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from "recharts";
import { TrendingUp, TrendingDown, Sparkles } from "lucide-react";
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
        fullDate: new Date(snapshot.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      }))
    : [{ date: 'Now', value: currentValue, fullDate: 'Now' }];

  const startValue = data.length > 0 ? data[0].value : currentValue;
  const percentChange = startValue > 0 ? ((currentValue - startValue) / startValue) * 100 : 0;
  const isPositive = percentChange >= 0;
  const absoluteChange = currentValue - startValue;

  // Calculate min/max for better chart scaling
  const values = data.map(d => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const padding = (maxValue - minValue) * 0.15 || 10000;

  return (
    <Card className="col-span-1 md:col-span-2 lg:col-span-3 relative overflow-hidden bg-gradient-to-br from-card via-card to-card/80 border-border/50">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-success/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
      
      <CardHeader className="pb-2 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Assets Trend</CardTitle>
            <Sparkles className="h-3.5 w-3.5 text-primary/60 animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className={`text-xs font-medium ${isPositive ? 'text-success' : 'text-destructive'}`}>
                {isPositive ? '+' : ''}{absoluteChange >= 0 ? '+' : ''}${Math.abs(absoluteChange).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${isPositive ? 'bg-success/10' : 'bg-destructive/10'}`}>
              {isPositive ? (
                <TrendingUp className="h-3.5 w-3.5 text-success" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-destructive" />
              )}
              <span className={`text-sm font-bold ${isPositive ? 'text-success' : 'text-destructive'}`}>
                {isPositive ? '+' : ''}{percentChange.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 relative z-10">
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="assetGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isPositive ? "hsl(var(--success))" : "hsl(var(--destructive))"} stopOpacity={0.3} />
                <stop offset="50%" stopColor={isPositive ? "hsl(var(--success))" : "hsl(var(--destructive))"} stopOpacity={0.1} />
                <stop offset="100%" stopColor={isPositive ? "hsl(var(--success))" : "hsl(var(--destructive))"} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="strokeGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={isPositive ? "hsl(var(--success))" : "hsl(var(--destructive))"} stopOpacity={0.6} />
                <stop offset="50%" stopColor={isPositive ? "hsl(var(--success))" : "hsl(var(--destructive))"} stopOpacity={1} />
                <stop offset="100%" stopColor={isPositive ? "hsl(var(--success))" : "hsl(var(--destructive))"} stopOpacity={0.8} />
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              stroke="hsl(var(--border))"
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              tickFormatter={(value, index) => {
                if (data.length <= 3) return value;
                if (index === 0 || index === Math.floor(data.length / 2) || index === data.length - 1) {
                  return value;
                }
                return '';
              }}
            />
            <YAxis 
              hide 
              domain={[minValue - padding, maxValue + padding]}
            />
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const value = payload[0].value as number;
                  const dataPoint = payload[0].payload;
                  return (
                    <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-xl">
                      <p className="text-xs text-muted-foreground mb-1">{dataPoint.fullDate}</p>
                      <p className="text-lg font-bold text-foreground">${value.toLocaleString()}</p>
                      {startValue > 0 && (
                        <p className={`text-xs mt-1 ${value >= startValue ? 'text-success' : 'text-destructive'}`}>
                          {value >= startValue ? '+' : ''}{(((value - startValue) / startValue) * 100).toFixed(2)}% from start
                        </p>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
            <ReferenceLine 
              y={startValue} 
              stroke="hsl(var(--muted-foreground))" 
              strokeDasharray="3 3" 
              strokeOpacity={0.3}
            />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke="url(#strokeGradient)"
              strokeWidth={2.5}
              fill="url(#assetGradient)"
              dot={false}
              activeDot={{ 
                r: 5, 
                fill: isPositive ? 'hsl(var(--success))' : 'hsl(var(--destructive))',
                stroke: 'hsl(var(--background))',
                strokeWidth: 2
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
        <div className="flex items-center justify-between mt-3 px-1">
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Starting</span>
            <span className="text-sm font-semibold text-foreground">${data[0].value.toLocaleString()}</span>
          </div>
          <div className="flex-1 mx-4 h-px bg-gradient-to-r from-border via-border/50 to-border" />
          <div className="flex flex-col text-right">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Current</span>
            <span className="text-sm font-semibold text-foreground">${currentValue.toLocaleString()}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
