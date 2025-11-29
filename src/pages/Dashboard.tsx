import { useState, useMemo, useEffect } from "react";
import { CommandPanelCard } from "@/components/dashboard/CommandPanelCard";
import { RadialGauge } from "@/components/dashboard/RadialGauge";
import { AssetsTrendChart } from "@/components/dashboard/AssetsTrendChart";
import { ImportBar } from "@/components/dashboard/ImportBar";
import { FiltersToolbar } from "@/components/dashboard/FiltersToolbar";
import { PositionsTable } from "@/components/dashboard/PositionsTable";
import { AssignedPositionsTable } from "@/components/dashboard/AssignedPositionsTable";
import { HistoryExpiredBatches } from "@/components/dashboard/HistoryExpiredBatches";
import { TimePeriodFilter, TimePeriod } from "@/components/dashboard/TimePeriodFilter";
import { PerformanceMetrics } from "@/components/dashboard/PerformanceMetrics";
import { ExpirationCalendar } from "@/components/dashboard/ExpirationCalendar";
import { AIPerformanceTracker } from "@/components/dashboard/AIPerformanceTracker";
import { LearningCenter } from "@/components/dashboard/LearningCenter";
import { DollarSign, FileText, Calendar, AlertTriangle, LogOut, Download, Share2, TrendingUp, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePositions } from "@/hooks/usePositions";
import { useAssignedPositions } from "@/hooks/useAssignedPositions";
import { useSettings } from "@/hooks/useSettings";
import { usePortfolioHistory } from "@/hooks/usePortfolioHistory";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CartesianGrid, Line, LineChart, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DateRange } from "react-day-picker";
import { startOfMonth, startOfYear, isAfter, isBefore, isWithinInterval } from "date-fns";

const Dashboard = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { positions, loading: positionsLoading, sharedOwners, refetch } = usePositions();
  const { assignedPositions, loading: assignedLoading, refetch: refetchAssigned } = useAssignedPositions();
  const { settings } = useSettings(user?.id);
  const { history: portfolioHistory, recordSnapshot } = usePortfolioHistory(user?.id);
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("all");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  
  const hasSharedPositions = sharedOwners && sharedOwners.size > 0;
  const ownPositions = positions.filter(p => !sharedOwners?.has(p.id));
  const sharedPositions = positions.filter(p => sharedOwners?.has(p.id));

  // Filter positions by time period
  const filteredPositions = useMemo(() => {
    const now = new Date();
    
    return positions.filter(position => {
      const positionDate = new Date(position.expiration);
      
      switch (timePeriod) {
        case "mtd":
          return isAfter(positionDate, startOfMonth(now));
        case "ytd":
          return isAfter(positionDate, startOfYear(now));
        case "custom":
          if (customDateRange?.from && customDateRange?.to) {
            return isWithinInterval(positionDate, {
              start: customDateRange.from,
              end: customDateRange.to,
            });
          }
          return true;
        case "all":
        default:
          return true;
      }
    });
  }, [positions, timePeriod, customDateRange]);

  // Separate active (not expired) and expired positions
  const activePositions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return filteredPositions.filter(position => {
      const expirationDate = new Date(position.expiration);
      return expirationDate >= today;
    });
  }, [filteredPositions]);

  const expiredPositions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get IDs of positions that have been assigned
    const assignedPositionIds = new Set(
      assignedPositions
        .map(ap => ap.original_position_id)
        .filter(Boolean)
    );
    
    return filteredPositions.filter(position => {
      const expirationDate = new Date(position.expiration);
      const isExpired = expirationDate < today;
      const wasAssigned = assignedPositionIds.has(position.id);
      
      // Include only expired positions that were NOT assigned
      // (assigned positions' premiums are counted separately)
      return isExpired && !wasAssigned;
    });
  }, [filteredPositions, assignedPositions]);

  // Filter assigned positions by time period
  const filteredAssignedPositions = useMemo(() => {
    const now = new Date();
    
    return assignedPositions.filter(position => {
      const assignmentDate = new Date(position.assignment_date);
      
      switch (timePeriod) {
        case "mtd":
          return isAfter(assignmentDate, startOfMonth(now));
        case "ytd":
          return isAfter(assignmentDate, startOfYear(now));
        case "custom":
          if (customDateRange?.from && customDateRange?.to) {
            return isWithinInterval(assignmentDate, {
              start: customDateRange.from,
              end: customDateRange.to,
            });
          }
          return true;
        case "all":
        default:
          return true;
      }
    });
  }, [assignedPositions, timePeriod, customDateRange]);

  const getModelDisplayName = (model: string) => {
    switch (model) {
      case 'delta': return 'Option Delta';
      case 'black-scholes': return 'Black-Scholes';
      case 'heuristic': return 'Heuristic';
      default: return model;
    }
  };

  const handleRefreshMarketData = async () => {
    setRefreshing(true);
    try {
      await supabase.functions.invoke('refresh-market-data');
      await refetch();
      toast({
        title: "Market data refreshed",
        description: "All stock prices have been updated.",
      });
    } catch (error) {
      toast({
        title: "Refresh failed",
        description: "Could not update market data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };
  
  // Calculate portfolio stats
  // 1. Total Premiums: active + expired (non-assigned) puts + assigned put premiums + covered call premiums
  // Assigned positions' premiums are counted via assignedPutPremiums, not expiredPremiums
  const activePremiums = activePositions.reduce((sum, p) => sum + p.totalPremium, 0);
  const expiredPremiums = expiredPositions.reduce((sum, p) => sum + p.totalPremium, 0);
  const assignedPutPremiums = filteredAssignedPositions.reduce((sum, p) => sum + p.original_put_premium, 0);
  const coveredCallPremiums = filteredAssignedPositions.reduce((sum, p) => sum + (p.total_call_premiums || 0), 0);
  const totalPremium = activePremiums + expiredPremiums + assignedPutPremiums + coveredCallPremiums;
  
  // Debug logging for premium calculation
  console.log('Premium Breakdown:', {
    activePremiums: activePremiums.toFixed(2),
    activeCount: activePositions.length,
    expiredPremiums: expiredPremiums.toFixed(2),
    expiredCount: expiredPositions.length,
    assignedPutPremiums: assignedPutPremiums.toFixed(2),
    assignedCount: filteredAssignedPositions.length,
    coveredCallPremiums: coveredCallPremiums.toFixed(2),
    totalPremium: totalPremium.toFixed(2),
    note: 'expired excludes assigned positions to avoid double-counting'
  });
  
  // 2. Assigned Shares Metrics
  const assignedSharesCostBasis = filteredAssignedPositions.reduce((sum, p) => 
    sum + (p.cost_basis * p.shares), 0
  );
  const assignedSharesMarketValue = filteredAssignedPositions.reduce((sum, p) => 
    sum + ((p.current_price || p.assignment_price) * p.shares), 0
  );
  const assignedSharesUnrealizedPnL = filteredAssignedPositions.reduce((sum, p) => 
    sum + (p.unrealized_pnl || 0), 0
  );
  
  // 3. Active Positions Metrics
  const totalUnrealizedPnL = activePositions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
  const activeContracts = activePositions.reduce((sum, p) => sum + p.contracts, 0);
  const atRiskCount = activePositions.filter(p => p.pctAboveStrike < 5).length;
  const cashSecured = activePositions.reduce((sum, p) => sum + (p.strikePrice * 100 * p.contracts), 0);
  
  // 4. Total Portfolio Value
  // If other_holdings_value represents total broker account, show it as baseline
  // Otherwise calculate: Cash + Other Holdings + Assigned Shares + Active Positions Unrealized P/L
  const totalPortfolioValue = (settings.other_holdings_value || 0) > 0 
    ? (settings.other_holdings_value || 0) 
    : (settings.cash_balance || 0) + assignedSharesMarketValue + totalUnrealizedPnL;
  
  // 5. Available Cash = Total Assets - Assigned Capital
  const availableCash = totalPortfolioValue - assignedSharesMarketValue;
  
  // Record portfolio snapshot when key metrics change
  useEffect(() => {
    if (!user?.id || authLoading || positionsLoading || assignedLoading) return;
    
    const recordPortfolioSnapshot = async () => {
      try {
        await recordSnapshot({
          portfolio_value: totalPortfolioValue,
          cash_balance: settings?.cash_balance || 0,
          positions_value: totalUnrealizedPnL,
          assigned_shares_value: assignedSharesMarketValue,
          total_premiums_collected: totalPremium,
          net_position_pnl: totalUnrealizedPnL,
          event_type: 'snapshot',
          event_description: 'Automated portfolio snapshot',
        });
      } catch (error) {
        console.error('Failed to record portfolio snapshot:', error);
      }
    };

    // Record snapshot on significant changes
    recordPortfolioSnapshot();
  }, [user?.id, totalPortfolioValue, totalPremium, assignedSharesMarketValue, totalUnrealizedPnL]);
  
  // Find next expiration (use active positions only)
  const sortedByExp = [...activePositions].sort((a, b) => a.daysToExp - b.daysToExp);
  const nextExp = sortedByExp[0];

  // Export to CSV (use active positions only)
  const exportToCSV = () => {
    const headers = ['Symbol', 'Strike', 'Expiration', 'Contracts', 'Premium/ct', 'Total Premium', 'Unrealized P/L', 'Days to Exp', '% Above Strike', 'Prob Assignment'];
    const rows = activePositions.map(p => [
      p.symbol,
      p.strikePrice,
      p.expiration,
      p.contracts,
      p.premiumPerContract,
      p.totalPremium,
      p.unrealizedPnL,
      p.daysToExp,
      p.pctAboveStrike,
      p.probAssignment,
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `csp-positions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Chart data for P/L over time (use active positions only)
  const chartData = activePositions.map(p => ({
    name: p.symbol,
    pnl: p.unrealizedPnL,
  })).sort((a, b) => b.pnl - a.pnl).slice(0, 10);

  if (authLoading || positionsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Calculate ROC metrics
  const annualizedROC = totalPremium > 0 && totalPortfolioValue > 0 
    ? ((totalPremium / totalPortfolioValue) * (365 / 30)) * 100 
    : 0;
  
  const cycleCompletions = expiredPositions.length > 0 && positions.length > 0
    ? (expiredPositions.length / positions.length) * 100
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        {/* Top Action Bar */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Terminal</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time position tracking & analytics
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleRefreshMarketData} 
              disabled={refreshing}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={exportToCSV} 
              disabled={activePositions.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={signOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Shared Dashboard Alert */}
        {hasSharedPositions && (
          <Alert>
            <Share2 className="h-4 w-4" />
            <AlertDescription>
              {sharedPositions.length === positions.length ? (
                <>Viewing shared dashboard. You have read-only access to these positions.</>
              ) : (
                <>You're viewing {ownPositions.length} of your own positions and {sharedPositions.length} shared position{sharedPositions.length !== 1 ? 's' : ''}.</>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Time Period Filter */}
        <TimePeriodFilter
          selectedPeriod={timePeriod}
          onPeriodChange={setTimePeriod}
          customDateRange={customDateRange}
          onCustomDateRangeChange={setCustomDateRange}
        />

        {/* Portfolio Command Panel */}
        <Card id="dashboard" className="scroll-mt-6 overflow-hidden">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-lg">Portfolio Command Panel</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              <CommandPanelCard
                label="Total Assets"
                value={`$${(totalPortfolioValue / 1000).toFixed(1)}K`}
                subtitle="Complete portfolio value"
                icon={TrendingUp}
              />
              <CommandPanelCard
                label="Total Premium"
                value={`$${totalPremium.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                subtitle="All puts + calls collected"
                icon={DollarSign}
              />
              <CommandPanelCard
                label="Net Position P/L"
                value={`$${totalUnrealizedPnL.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                subtitle="Unrealized gains/losses"
                icon={TrendingUp}
                trend={{ value: `${totalUnrealizedPnL >= 0 ? '+' : ''}${totalUnrealizedPnL.toFixed(0)}`, isPositive: totalUnrealizedPnL >= 0 }}
              />
              <CommandPanelCard
                label="Assigned Capital"
                value={`$${assignedSharesMarketValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                subtitle={`Cost: $${assignedSharesCostBasis.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                icon={FileText}
              />
              <CommandPanelCard
                label="Cash Secured"
                value={`$${cashSecured.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                subtitle={`${activeContracts} active contracts`}
                icon={Calendar}
              />
              <CommandPanelCard
                label="Available Cash"
                value={`$${(availableCash / 1000).toFixed(1)}K`}
                subtitle="Liquid capital"
                icon={DollarSign}
              />
              <div className="col-span-1">
                <Card className="h-full">
                  <CardContent className="p-0">
                    <RadialGauge 
                      value={annualizedROC} 
                      max={100} 
                      label="Annualized ROC"
                      unit="%"
                    />
                  </CardContent>
                </Card>
              </div>
              <CommandPanelCard
                label="At-Risk"
                value={atRiskCount.toString()}
                subtitle="< 5% above strike"
                icon={AlertTriangle}
              />
              
              {/* Assets Trend Chart - spans multiple columns */}
              <AssetsTrendChart currentValue={totalPortfolioValue} history={portfolioHistory} />
            </div>
          </CardContent>
        </Card>

        {/* Import Bar */}
        <ImportBar />

        {/* Filters */}
        <FiltersToolbar
          onSearchChange={() => {}}
          onRiskBandChange={() => {}}
          onExpirationChange={() => {}}
        />

        {/* Performance Analytics */}
        <div id="analytics" className="scroll-mt-6">
          <PerformanceMetrics positions={activePositions} />
        </div>

        {/* AI Performance Tracking */}
        <AIPerformanceTracker />

        {/* Expiration Calendar */}
        <ExpirationCalendar positions={activePositions} />

        {/* Active Positions Matrix */}
        <Card id="positions" className="scroll-mt-6">
          <CardHeader className="border-b border-border">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Active Positions Matrix</CardTitle>
              <div className="flex items-center gap-2">
                <div className="flex items-center border border-border rounded-lg p-1">
                  <button className="px-3 py-1 text-xs rounded bg-primary text-primary-foreground">All</button>
                  <button className="px-3 py-1 text-xs rounded text-muted-foreground hover:bg-muted">By DTE</button>
                  <button className="px-3 py-1 text-xs rounded text-muted-foreground hover:bg-muted">By Risk</button>
                </div>
                <Button variant="outline" size="sm" className="text-xs">
                  AI Insight
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {activePositions.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                No active positions found for the selected time period.
              </div>
            ) : (
              <PositionsTable 
                positions={activePositions} 
                onRefetch={refetch}
                onRefetchAssigned={refetchAssigned}
              />
            )}
          </CardContent>
        </Card>

        {/* Assigned Positions Zone */}
        <Card id="assignments" className="scroll-mt-6">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-lg">Assigned Positions Zone</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <AssignedPositionsTable positions={filteredAssignedPositions} onRefetch={refetchAssigned} />
          </CardContent>
        </Card>

        {/* History Zone */}
        {expiredPositions.length > 0 && (
          <Card id="history" className="scroll-mt-6">
            <CardHeader className="border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">History Zone</CardTitle>
                <Badge variant="outline" className="text-xs">vintage cards</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <HistoryExpiredBatches 
                positions={expiredPositions} 
                onRefetch={refetch}
                onRefetchAssigned={refetchAssigned}
              />
            </CardContent>
          </Card>
        )}

        {/* Learning Center */}
        <LearningCenter />
      </div>
    </div>
  );
};

export default Dashboard;
