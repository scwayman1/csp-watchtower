import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePremiumAudit } from "@/hooks/usePremiumAudit";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import { format, parseISO, startOfMonth, getMonth, getYear } from "date-fns";
import { DollarSign, TrendingUp, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface MonthlyData {
  month: string;
  putPremium: number;
  callPremium: number;
  total: number;
}

export default function PremiumAnalytics() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [symbolFilter, setSymbolFilter] = useState<string>("all");
  
  const { breakdown, loading } = usePremiumAudit(user?.id, { timePeriod: "all" });

  // Get unique symbols from audit records
  const uniqueSymbols = useMemo(() => {
    if (!breakdown?.auditRecords) return [];
    const symbols = new Set(breakdown.auditRecords.map(r => r.symbol));
    return Array.from(symbols).sort();
  }, [breakdown?.auditRecords]);

  // Filter records by symbol and aggregate by month
  const monthlyData = useMemo(() => {
    if (!breakdown?.auditRecords) return [];

    const filtered = symbolFilter === "all" 
      ? breakdown.auditRecords 
      : breakdown.auditRecords.filter(r => r.symbol === symbolFilter);

    // Group by month
    const monthMap = new Map<string, { putPremium: number; callPremium: number }>();

    filtered.forEach(record => {
      const date = parseISO(record.date);
      const monthKey = format(startOfMonth(date), "yyyy-MM");
      
      const existing = monthMap.get(monthKey) || { putPremium: 0, callPremium: 0 };
      
      if (record.category.includes('put')) {
        existing.putPremium += record.premium;
      } else {
        existing.callPremium += record.premium;
      }
      
      monthMap.set(monthKey, existing);
    });

    // Convert to array and sort by date
    const result: MonthlyData[] = Array.from(monthMap.entries())
      .map(([month, data]) => ({
        month: format(parseISO(month + "-01"), "MMM yyyy"),
        putPremium: Math.round(data.putPremium),
        callPremium: Math.round(data.callPremium),
        total: Math.round(data.putPremium + data.callPremium),
      }))
      .sort((a, b) => {
        const dateA = new Date(a.month);
        const dateB = new Date(b.month);
        return dateA.getTime() - dateB.getTime();
      });

    return result;
  }, [breakdown?.auditRecords, symbolFilter]);

  // Calculate totals for the filtered data
  const filteredTotals = useMemo(() => {
    return monthlyData.reduce(
      (acc, d) => ({
        putPremium: acc.putPremium + d.putPremium,
        callPremium: acc.callPremium + d.callPremium,
        total: acc.total + d.total,
      }),
      { putPremium: 0, callPremium: 0, total: 0 }
    );
  }, [monthlyData]);

  const chartConfig = {
    putPremium: {
      label: "Put Premium",
      color: "hsl(var(--chart-1))",
    },
    callPremium: {
      label: "Call Premium", 
      color: "hsl(var(--chart-2))",
    },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Premium Analytics</h1>
            <p className="text-muted-foreground">Monthly breakdown of put vs call premium income</p>
          </div>
        </div>
        
        {/* Symbol Filter */}
        <Select value={symbolFilter} onValueChange={setSymbolFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by symbol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Symbols</SelectItem>
            {uniqueSymbols.map(symbol => (
              <SelectItem key={symbol} value={symbol}>{symbol}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Put Premium</CardDescription>
            <CardTitle className="text-2xl text-chart-1">
              ${filteredTotals.putPremium.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Call Premium</CardDescription>
            <CardTitle className="text-2xl text-chart-2">
              ${filteredTotals.callPremium.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Combined Total</CardDescription>
            <CardTitle className="text-2xl text-primary">
              ${filteredTotals.total.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Monthly Premium Income
          </CardTitle>
          <CardDescription>
            {symbolFilter === "all" ? "All symbols" : symbolFilter} - Put vs Call premium by month
          </CardDescription>
        </CardHeader>
        <CardContent>
          {monthlyData.length === 0 ? (
            <div className="flex items-center justify-center h-[400px] text-muted-foreground">
              No premium data available
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                  />
                  <YAxis 
                    tickFormatter={(value) => `$${value.toLocaleString()}`}
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                  />
                  <ChartTooltip 
                    content={<ChartTooltipContent />}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                  />
                  <Legend />
                  <Bar 
                    dataKey="putPremium" 
                    name="Put Premium" 
                    fill="hsl(var(--chart-1))" 
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar 
                    dataKey="callPremium" 
                    name="Call Premium" 
                    fill="hsl(var(--chart-2))" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Monthly Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Monthly Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Month</th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground">Put Premium</th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground">Call Premium</th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((row, idx) => (
                  <tr key={idx} className="border-b border-border/50 hover:bg-muted/50">
                    <td className="py-3 px-2 font-medium">{row.month}</td>
                    <td className="py-3 px-2 text-right text-chart-1">${row.putPremium.toLocaleString()}</td>
                    <td className="py-3 px-2 text-right text-chart-2">${row.callPremium.toLocaleString()}</td>
                    <td className="py-3 px-2 text-right font-medium">${row.total.toLocaleString()}</td>
                  </tr>
                ))}
                {monthlyData.length > 0 && (
                  <tr className="bg-muted/30 font-medium">
                    <td className="py-3 px-2">Total</td>
                    <td className="py-3 px-2 text-right text-chart-1">${filteredTotals.putPremium.toLocaleString()}</td>
                    <td className="py-3 px-2 text-right text-chart-2">${filteredTotals.callPremium.toLocaleString()}</td>
                    <td className="py-3 px-2 text-right">${filteredTotals.total.toLocaleString()}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
