import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePremiumAudit } from "@/hooks/usePremiumAudit";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, PieChart, Pie, Cell, Tooltip } from "recharts";
import { format, parseISO, startOfMonth, subMonths, subDays, isAfter, startOfYear, getYear } from "date-fns";
import { DollarSign, TrendingUp, TrendingDown, ArrowLeft, PieChartIcon, BarChart3, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

interface MonthlyData {
  month: string;
  monthKey: string;
  putPremium: number;
  callPremium: number;
  total: number;
  cumulative: number;
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
    const sorted = Array.from(monthMap.entries())
      .map(([monthKey, data]) => ({
        month: format(parseISO(monthKey + "-01"), "MMM yyyy"),
        monthKey,
        putPremium: Math.round(data.putPremium),
        callPremium: Math.round(data.callPremium),
        total: Math.round(data.putPremium + data.callPremium),
        cumulative: 0,
      }))
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

    // Calculate cumulative totals
    let runningTotal = 0;
    const result: MonthlyData[] = sorted.map(item => {
      runningTotal += item.total;
      return { ...item, cumulative: runningTotal };
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

  // Performance Comparison - MoM and YoY
  const performanceComparison = useMemo(() => {
    if (!breakdown?.auditRecords) return null;

    const now = new Date();
    const thisMonth = format(startOfMonth(now), "yyyy-MM");
    const lastMonth = format(startOfMonth(subMonths(now, 1)), "yyyy-MM");
    const lastYearSameMonth = format(startOfMonth(new Date(now.getFullYear() - 1, now.getMonth())), "yyyy-MM");
    const thisYear = now.getFullYear();
    const lastYear = thisYear - 1;

    const thisMonthData = monthlyData.find(m => m.monthKey === thisMonth);
    const lastMonthData = monthlyData.find(m => m.monthKey === lastMonth);
    const lastYearMonthData = monthlyData.find(m => m.monthKey === lastYearSameMonth);

    // YTD calculations
    const ytdThisYear = monthlyData
      .filter(m => m.monthKey.startsWith(String(thisYear)))
      .reduce((sum, m) => sum + m.total, 0);
    const ytdLastYear = monthlyData
      .filter(m => m.monthKey.startsWith(String(lastYear)))
      .reduce((sum, m) => sum + m.total, 0);

    const momChange = lastMonthData && lastMonthData.total > 0
      ? ((thisMonthData?.total || 0) - lastMonthData.total) / lastMonthData.total * 100
      : null;

    const yoyChange = lastYearMonthData && lastYearMonthData.total > 0
      ? ((thisMonthData?.total || 0) - lastYearMonthData.total) / lastYearMonthData.total * 100
      : null;

    const ytdChange = ytdLastYear > 0
      ? (ytdThisYear - ytdLastYear) / ytdLastYear * 100
      : null;

    return {
      thisMonth: thisMonthData?.total || 0,
      lastMonth: lastMonthData?.total || 0,
      lastYearMonth: lastYearMonthData?.total || 0,
      momChange,
      yoyChange,
      ytdThisYear,
      ytdLastYear,
      ytdChange
    };
  }, [breakdown?.auditRecords, monthlyData]);

  // Distribution by symbol
  const symbolDistribution = useMemo(() => {
    if (!breakdown?.auditRecords || symbolFilter !== "all") return [];

    const symbolMap = new Map<string, number>();
    breakdown.auditRecords.forEach(record => {
      const existing = symbolMap.get(record.symbol) || 0;
      symbolMap.set(record.symbol, existing + record.premium);
    });

    return Array.from(symbolMap.entries())
      .map(([symbol, premium]) => ({ name: symbol, value: Math.round(premium) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Top 8 symbols
  }, [breakdown?.auditRecords, symbolFilter]);

  // Put vs Call distribution for pie chart
  const typeDistribution = useMemo(() => {
    return [
      { name: 'Put Premium', value: filteredTotals.putPremium, color: '#ec4899' },
      { name: 'Call Premium', value: filteredTotals.callPremium, color: '#10b981' }
    ].filter(d => d.value > 0);
  }, [filteredTotals]);

  // Rolling averages (30-day and 90-day)
  const rollingAverages = useMemo(() => {
    if (!breakdown?.auditRecords) return { avg30: 0, avg90: 0 };

    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);
    const ninetyDaysAgo = subDays(now, 90);

    const filtered = symbolFilter === "all"
      ? breakdown.auditRecords
      : breakdown.auditRecords.filter(r => r.symbol === symbolFilter);

    const last30 = filtered.filter(r => isAfter(parseISO(r.date), thirtyDaysAgo));
    const last90 = filtered.filter(r => isAfter(parseISO(r.date), ninetyDaysAgo));

    const sum30 = last30.reduce((sum, r) => sum + r.premium, 0);
    const sum90 = last90.reduce((sum, r) => sum + r.premium, 0);

    return {
      avg30: Math.round(sum30),
      avg90: Math.round(sum90),
      dailyAvg30: Math.round(sum30 / 30),
      dailyAvg90: Math.round(sum90 / 90),
      monthlyAvg30: Math.round((sum30 / 30) * 30),
      monthlyAvg90: Math.round((sum90 / 90) * 30)
    };
  }, [breakdown?.auditRecords, symbolFilter]);

  const PIE_COLORS = ['#f472b6', '#34d399', '#60a5fa', '#fbbf24', '#a78bfa', '#fb7185', '#22d3ee', '#f97316'];

  const chartConfig = {
    putPremium: {
      label: "Put Premium",
      color: "hsl(var(--chart-1))",
    },
    callPremium: {
      label: "Call Premium", 
      color: "hsl(var(--chart-2))",
    },
    cumulative: {
      label: "Cumulative",
      color: "hsl(var(--chart-3))",
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

      {/* Performance Comparison Cards */}
      {performanceComparison && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-primary">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <BarChart3 className="h-3.5 w-3.5" />
                Month-over-Month
              </CardDescription>
              <div className="flex items-center gap-2">
                <CardTitle className="text-xl">
                  ${performanceComparison.thisMonth.toLocaleString()}
                </CardTitle>
                {performanceComparison.momChange !== null && (
                  <Badge 
                    variant={performanceComparison.momChange >= 0 ? "default" : "destructive"}
                    className="flex items-center gap-0.5"
                  >
                    {performanceComparison.momChange >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {performanceComparison.momChange >= 0 ? '+' : ''}{performanceComparison.momChange.toFixed(1)}%
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                vs ${performanceComparison.lastMonth.toLocaleString()} last month
              </p>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-chart-2">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <BarChart3 className="h-3.5 w-3.5" />
                Year-over-Year
              </CardDescription>
              <div className="flex items-center gap-2">
                <CardTitle className="text-xl">
                  ${performanceComparison.thisMonth.toLocaleString()}
                </CardTitle>
                {performanceComparison.yoyChange !== null && (
                  <Badge 
                    variant={performanceComparison.yoyChange >= 0 ? "default" : "destructive"}
                    className="flex items-center gap-0.5"
                  >
                    {performanceComparison.yoyChange >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {performanceComparison.yoyChange >= 0 ? '+' : ''}{performanceComparison.yoyChange.toFixed(1)}%
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                vs ${performanceComparison.lastYearMonth.toLocaleString()} same month last year
              </p>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-chart-1">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5" />
                YTD Comparison
              </CardDescription>
              <div className="flex items-center gap-2">
                <CardTitle className="text-xl">
                  ${performanceComparison.ytdThisYear.toLocaleString()}
                </CardTitle>
                {performanceComparison.ytdChange !== null && (
                  <Badge 
                    variant={performanceComparison.ytdChange >= 0 ? "default" : "destructive"}
                    className="flex items-center gap-0.5"
                  >
                    {performanceComparison.ytdChange >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {performanceComparison.ytdChange >= 0 ? '+' : ''}{performanceComparison.ytdChange.toFixed(1)}%
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                vs ${performanceComparison.ytdLastYear.toLocaleString()} YTD last year
              </p>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Activity className="h-3.5 w-3.5" />
                Rolling Averages
              </CardDescription>
              <CardTitle className="text-xl">
                ${rollingAverages.avg30.toLocaleString()}
              </CardTitle>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>30-day: ${rollingAverages.avg30.toLocaleString()} (${rollingAverages.dailyAvg30}/day)</p>
                <p>90-day: ${rollingAverages.avg90.toLocaleString()} (${rollingAverages.dailyAvg90}/day)</p>
              </div>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Put vs Call Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" />
              Put vs Call Split
            </CardTitle>
            <CardDescription>Distribution of premium by option type</CardDescription>
          </CardHeader>
          <CardContent>
            {typeDistribution.length === 0 ? (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                No data available
              </div>
            ) : (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={typeDistribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={50}
                      paddingAngle={2}
                      animationDuration={800}
                    >
                      {typeDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => `$${value.toLocaleString()}`}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="mt-4 grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Put %</p>
                <p className="text-lg font-bold text-chart-1">
                  {filteredTotals.total > 0 
                    ? ((filteredTotals.putPremium / filteredTotals.total) * 100).toFixed(1) 
                    : 0}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Call %</p>
                <p className="text-lg font-bold text-chart-2">
                  {filteredTotals.total > 0 
                    ? ((filteredTotals.callPremium / filteredTotals.total) * 100).toFixed(1) 
                    : 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Symbol Distribution */}
        {symbolFilter === "all" && symbolDistribution.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChartIcon className="h-5 w-5" />
                Premium by Symbol
              </CardTitle>
              <CardDescription>Top 8 symbols by premium collected</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={symbolDistribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={50}
                      paddingAngle={2}
                      animationDuration={800}
                    >
                      {symbolDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => `$${value.toLocaleString()}`}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2">
                {symbolDistribution.slice(0, 4).map((item, idx) => (
                  <div key={item.name} className="text-center">
                    <p className="text-xs text-muted-foreground">{item.name}</p>
                    <p className="text-sm font-medium" style={{ color: PIE_COLORS[idx] }}>
                      ${(item.value / 1000).toFixed(1)}k
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
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
                <ComposedChart data={monthlyData} margin={{ top: 20, right: 60, left: 20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="putGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f472b6" stopOpacity={1} />
                      <stop offset="50%" stopColor="#ec4899" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#be185d" stopOpacity={0.8} />
                    </linearGradient>
                    <linearGradient id="callGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity={1} />
                      <stop offset="50%" stopColor="#10b981" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#059669" stopOpacity={0.8} />
                    </linearGradient>
                    <linearGradient id="cumulativeGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#60a5fa" stopOpacity={1} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={1} />
                    </linearGradient>
                    <filter id="barShadow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3" />
                    </filter>
                    <filter id="lineShadow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#3b82f6" floodOpacity="0.4" />
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12, fontWeight: 500 }}
                    className="fill-muted-foreground"
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickLine={false}
                  />
                  <YAxis 
                    yAxisId="left"
                    tickFormatter={(value) => `$${value.toLocaleString()}`}
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                  />
                  <ChartTooltip 
                    content={<ChartTooltipContent />}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px' }}
                    iconType="circle"
                  />
                  <Bar 
                    yAxisId="left"
                    dataKey="putPremium" 
                    name="Put Premium" 
                    fill="url(#putGradient)" 
                    radius={[8, 8, 0, 0]}
                    filter="url(#barShadow)"
                    animationDuration={800}
                    animationEasing="ease-out"
                  />
                  <Bar 
                    yAxisId="left"
                    dataKey="callPremium" 
                    name="Call Premium" 
                    fill="url(#callGradient)" 
                    radius={[8, 8, 0, 0]}
                    filter="url(#barShadow)"
                    animationDuration={800}
                    animationEasing="ease-out"
                    animationBegin={200}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="cumulative"
                    name="Cumulative Total"
                    stroke="url(#cumulativeGradient)"
                    strokeWidth={3}
                    dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4, stroke: '#fff' }}
                    activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                    filter="url(#lineShadow)"
                    animationDuration={1000}
                    animationEasing="ease-out"
                    animationBegin={400}
                  />
                </ComposedChart>
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
