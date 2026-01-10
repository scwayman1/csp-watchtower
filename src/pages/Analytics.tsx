import { useState, useMemo, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePremiumAudit } from "@/hooks/usePremiumAudit";
import { useAssignedAnalytics } from "@/hooks/useAssignedAnalytics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, PieChart, Pie, Cell, Tooltip } from "recharts";
import { format, parseISO, startOfMonth, subMonths, subDays, isAfter, startOfYear } from "date-fns";
import { DollarSign, TrendingUp, TrendingDown, ArrowLeft, PieChartIcon, BarChart3, Activity, Layers, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CalledAwaySection } from "@/components/analytics/CalledAwaySection";
import { UnderwaterSection } from "@/components/analytics/UnderwaterSection";
import { AssignedOverviewSection } from "@/components/analytics/AssignedOverviewSection";
import { ReadableTooltipContent } from "@/components/analytics/ReadableTooltipContent";

interface MonthlyData {
  month: string;
  monthKey: string;
  putPremium: number;
  callPremium: number;
  total: number;
  cumulative: number;
}

type AnalyticsSection = 'premium' | 'assigned' | 'called-away' | 'underwater';

export default function Analytics() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [symbolFilter, setSymbolFilter] = useState<string>("all");
  
  const premiumRef = useRef<HTMLDivElement>(null);
  const assignedRef = useRef<HTMLDivElement>(null);
  const calledAwayRef = useRef<HTMLDivElement>(null);
  const underwaterRef = useRef<HTMLDivElement>(null);
  
  const { breakdown, loading: premiumLoading } = usePremiumAudit(user?.id, { timePeriod: "all" });
  const { analytics, loading: assignedLoading } = useAssignedAnalytics(user?.id);

  const scrollToSection = (section: AnalyticsSection) => {
    const refs = {
      'premium': premiumRef,
      'assigned': assignedRef,
      'called-away': calledAwayRef,
      'underwater': underwaterRef,
    };
    refs[section]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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

    let runningTotal = 0;
    return sorted.map(item => {
      runningTotal += item.total;
      return { ...item, cumulative: runningTotal };
    });
  }, [breakdown?.auditRecords, symbolFilter]);

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
      .slice(0, 8);
  }, [breakdown?.auditRecords, symbolFilter]);

  const typeDistribution = useMemo(() => {
    return [
      { name: 'Put Premium', value: filteredTotals.putPremium, color: '#ec4899' },
      { name: 'Call Premium', value: filteredTotals.callPremium, color: '#10b981' }
    ].filter(d => d.value > 0);
  }, [filteredTotals]);

  const rollingAverages = useMemo(() => {
    if (!breakdown?.auditRecords) return { avg30: 0, avg90: 0, dailyAvg30: 0, dailyAvg90: 0 };

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
    };
  }, [breakdown?.auditRecords, symbolFilter]);

  // Calculate profitable vs underwater active positions
  const profitableCount = useMemo(() => {
    if (!analytics) return 0;
    return analytics.currentlyAssigned - analytics.underwaterPositions.length;
  }, [analytics]);

  const PIE_COLORS = ['#f472b6', '#34d399', '#60a5fa', '#fbbf24', '#a78bfa', '#fb7185', '#22d3ee', '#f97316'];

  const chartConfig = {
    putPremium: { label: "Put Premium", color: "hsl(var(--chart-1))" },
    callPremium: { label: "Call Premium", color: "hsl(var(--chart-2))" },
    cumulative: { label: "Cumulative", color: "hsl(var(--chart-3))" },
  };

  const loading = premiumLoading || assignedLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Portfolio Analytics</h1>
            <p className="text-muted-foreground">Comprehensive view of premium, assignments, and recovery</p>
          </div>
        </div>
      </div>

      {/* Quick Nav */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => scrollToSection('premium')}>
          <DollarSign className="h-4 w-4 mr-1" /> Premium
        </Button>
        <Button variant="outline" size="sm" onClick={() => scrollToSection('assigned')}>
          <Layers className="h-4 w-4 mr-1" /> Assigned Overview
        </Button>
        <Button variant="outline" size="sm" onClick={() => scrollToSection('called-away')}>
          <CheckCircle className="h-4 w-4 mr-1" /> Called Away
        </Button>
        <Button variant="outline" size="sm" onClick={() => scrollToSection('underwater')}>
          <AlertTriangle className="h-4 w-4 mr-1" /> Underwater
        </Button>
      </div>

      {/* ======================== PREMIUM SECTION ======================== */}
      <div ref={premiumRef} className="scroll-mt-20">
        <div className="flex items-center gap-3 mb-6">
          <DollarSign className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-bold">Premium Analytics</h2>
          <Separator className="flex-1" />
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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

        {/* Performance Comparison */}
        {performanceComparison && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
                    <Badge variant={performanceComparison.momChange >= 0 ? "default" : "destructive"} className="flex items-center gap-0.5">
                      {performanceComparison.momChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {performanceComparison.momChange >= 0 ? '+' : ''}{performanceComparison.momChange.toFixed(1)}%
                    </Badge>
                  )}
                </div>
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
                    <Badge variant={performanceComparison.yoyChange >= 0 ? "default" : "destructive"} className="flex items-center gap-0.5">
                      {performanceComparison.yoyChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {performanceComparison.yoyChange >= 0 ? '+' : ''}{performanceComparison.yoyChange.toFixed(1)}%
                    </Badge>
                  )}
                </div>
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
                    <Badge variant={performanceComparison.ytdChange >= 0 ? "default" : "destructive"} className="flex items-center gap-0.5">
                      {performanceComparison.ytdChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {performanceComparison.ytdChange >= 0 ? '+' : ''}{performanceComparison.ytdChange.toFixed(1)}%
                    </Badge>
                  )}
                </div>
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

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Put vs Call Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChartIcon className="h-5 w-5" />
                Put vs Call Split
              </CardTitle>
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
                      <Pie data={typeDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={50} paddingAngle={2}>
                        {typeDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={
                          <ReadableTooltipContent
                            valueFormatter={(v) => `$${v.toLocaleString()}`}
                            labelFormatter={(l) => l}
                          />
                        }
                        wrapperStyle={{ zIndex: 50 }}
                      />
                      <Legend
                        formatter={(value: string) => (
                          <span style={{ color: 'hsl(var(--foreground))' }}>{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
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
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={symbolDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={50} paddingAngle={2}>
                        {symbolDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={
                          <ReadableTooltipContent
                            valueFormatter={(v) => `$${v.toLocaleString()}`}
                            labelFormatter={(l) => l}
                          />
                        }
                        wrapperStyle={{ zIndex: 50 }}
                      />
                      <Legend
                        formatter={(value: string) => (
                          <span style={{ color: 'hsl(var(--foreground))' }}>{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Monthly Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Monthly Premium Income
            </CardTitle>
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
                        <stop offset="100%" stopColor="#be185d" stopOpacity={0.8} />
                      </linearGradient>
                      <linearGradient id="callGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" stopOpacity={1} />
                        <stop offset="100%" stopColor="#059669" stopOpacity={0.8} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                    <YAxis yAxisId="left" tickFormatter={(v) => `$${v.toLocaleString()}`} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                    <ChartTooltip content={<ChartTooltipContent />} formatter={(value: number) => [`$${value.toLocaleString()}`, '']} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="putPremium" name="Put Premium" fill="url(#putGradient)" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="left" dataKey="callPremium" name="Call Premium" fill="url(#callGradient)" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="cumulative" name="Cumulative" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ======================== ASSIGNED OVERVIEW SECTION ======================== */}
      <div ref={assignedRef} className="scroll-mt-20">
        <div className="flex items-center gap-3 mb-6">
          <Layers className="h-6 w-6 text-chart-2" />
          <h2 className="text-xl font-bold">Assigned Positions Overview</h2>
          <Separator className="flex-1" />
        </div>

        {analytics && (
          <AssignedOverviewSection
            totalAssignedEver={analytics.totalAssignedEver}
            currentlyAssigned={analytics.currentlyAssigned}
            totalRealizedFromAssignments={analytics.totalRealizedFromAssignments}
            calledAwayCount={analytics.calledAwayPositions.length}
            underwaterCount={analytics.underwaterPositions.length}
            profitableCount={profitableCount}
          />
        )}
      </div>

      {/* ======================== CALLED AWAY SECTION ======================== */}
      <div ref={calledAwayRef} className="scroll-mt-20">
        <div className="flex items-center gap-3 mb-6">
          <CheckCircle className="h-6 w-6 text-success" />
          <h2 className="text-xl font-bold">Called Away Analysis</h2>
          <Separator className="flex-1" />
        </div>

        {analytics && (
          <CalledAwaySection
            positions={analytics.calledAwayPositions}
            totalGain={analytics.totalCalledAwayGain}
            avgDays={analytics.avgDaysToCalledAway}
            strikeEfficiency={analytics.strikeEfficiency}
            byMonth={analytics.calledAwayByMonth}
          />
        )}
      </div>

      {/* ======================== UNDERWATER SECTION ======================== */}
      <div ref={underwaterRef} className="scroll-mt-20">
        <div className="flex items-center gap-3 mb-6">
          <AlertTriangle className="h-6 w-6 text-destructive" />
          <h2 className="text-xl font-bold">Underwater & Recovery Analysis</h2>
          <Separator className="flex-1" />
        </div>

        {analytics && (
          <UnderwaterSection
            underwaterPositions={analytics.underwaterPositions}
            totalExposure={analytics.totalUnderwaterExposure}
            totalPremiumCollected={analytics.totalPremiumWhileUnderwater}
            avgBreakEvenProgress={analytics.avgBreakEvenProgress}
            recoveredPositions={analytics.recoveredPositions}
            avgRecoveryDays={analytics.avgRecoveryDays}
            recoveryRate={analytics.recoveryRate}
          />
        )}
      </div>
    </div>
  );
}
