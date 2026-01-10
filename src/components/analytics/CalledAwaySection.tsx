import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Clock, Target, DollarSign, CheckCircle } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import type { CalledAwayPosition } from "@/hooks/useAssignedAnalytics";
import { format, parseISO } from "date-fns";

interface CalledAwaySectionProps {
  positions: CalledAwayPosition[];
  totalGain: number;
  avgDays: number;
  strikeEfficiency: number;
  byMonth: { month: string; gain: number; count: number }[];
}

export function CalledAwaySection({ 
  positions, 
  totalGain, 
  avgDays, 
  strikeEfficiency,
  byMonth 
}: CalledAwaySectionProps) {
  const formatCurrency = (value: number) => 
    `$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-success">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5" />
              Called Away Count
            </CardDescription>
            <CardTitle className="text-2xl">{positions.length}</CardTitle>
          </CardHeader>
        </Card>
        
        <Card className="border-l-4 border-l-success">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5" />
              Total Realized Gain
            </CardDescription>
            <CardTitle className="text-2xl text-success">
              {formatCurrency(totalGain)}
            </CardTitle>
          </CardHeader>
        </Card>
        
        <Card className="border-l-4 border-l-chart-2">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Avg Days Held
            </CardDescription>
            <CardTitle className="text-2xl">{Math.round(avgDays)}</CardTitle>
          </CardHeader>
        </Card>
        
        <Card className="border-l-4 border-l-chart-1">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Target className="h-3.5 w-3.5" />
              Strike Efficiency
            </CardDescription>
            <CardTitle className="text-2xl">
              {strikeEfficiency >= 0 ? '+' : ''}{strikeEfficiency.toFixed(1)}%
            </CardTitle>
            <p className="text-xs text-muted-foreground">Avg gain above cost basis</p>
          </CardHeader>
        </Card>
      </div>

      {/* Monthly Chart */}
      {byMonth.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Called Away by Month
            </CardTitle>
            <CardDescription>Realized gains from shares called away</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byMonth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                  />
                  <YAxis 
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Gain']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar 
                    dataKey="gain" 
                    fill="hsl(var(--success))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Positions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Called Away Breakdown
          </CardTitle>
          <CardDescription>Capital gain + call premium per position</CardDescription>
        </CardHeader>
        <CardContent>
          {positions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No called away positions yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Symbol</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Shares</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Cost Basis</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Sold At</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Capital Gain</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Call Premium</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Total</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos) => (
                    <tr key={pos.id} className="border-b border-border/50 hover:bg-muted/50">
                      <td className="py-3 px-2">
                        <span className="font-medium">{pos.symbol}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {format(parseISO(pos.closedAt), "MM/dd/yy")}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right">{pos.shares}</td>
                      <td className="py-3 px-2 text-right">${pos.costBasis.toFixed(2)}</td>
                      <td className="py-3 px-2 text-right">${pos.soldPrice.toFixed(2)}</td>
                      <td className={`py-3 px-2 text-right ${pos.capitalGain >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {pos.capitalGain >= 0 ? '+' : ''}{formatCurrency(pos.capitalGain)}
                      </td>
                      <td className="py-3 px-2 text-right text-chart-2">
                        +{formatCurrency(pos.callPremium)}
                      </td>
                      <td className="py-3 px-2 text-right font-medium text-success">
                        +{formatCurrency(pos.totalRealized)}
                      </td>
                      <td className="py-3 px-2 text-right text-muted-foreground">{pos.daysHeld}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
