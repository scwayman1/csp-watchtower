import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CommandPanelCard } from "@/components/dashboard/CommandPanelCard";
import { FirstTimeUserGuide } from "@/components/onboarding/FirstTimeUserGuide";
import { useOnboarding } from "@/hooks/useOnboarding";
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
import { CalledAwayPositions } from "@/components/dashboard/CalledAwayPositions";
import { CalledAwayConfirmDialog } from "@/components/dashboard/CalledAwayConfirmDialog";
import { AssignedCapitalDialog } from "@/components/dashboard/AssignedCapitalDialog";
import { ActivePositionsBatchHeader } from "@/components/dashboard/ActivePositionsBatchHeader";
import { MiniSparkline } from "@/components/dashboard/MiniSparkline";
import { DollarSign, FileText, Calendar, AlertTriangle, LogOut, Download, Share2, TrendingUp, RefreshCw, Wallet, PiggyBank, Target, BarChart3 } from "lucide-react";
import { TooltipHeader, TooltipRow, TooltipChartWrapper, TooltipContainer, TooltipPositionRow, TooltipScrollArea, TooltipDivider, TooltipEmptyState } from "@/components/dashboard/MetricTooltip";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { useAuth } from "@/hooks/useAuth";
import { usePositions } from "@/hooks/usePositions";
import { useAssignedPositions } from "@/hooks/useAssignedPositions";
import { useCalledAwayDetection } from "@/hooks/useCalledAwayDetection";
import { usePremiumAudit } from "@/hooks/usePremiumAudit";
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

interface DashboardProps {
  viewAsUserId?: string;
  isAdvisorView?: boolean;
}

const Dashboard = ({ viewAsUserId, isAdvisorView = false }: DashboardProps = {}) => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { showGuide, dismissGuide, userRole } = useOnboarding();
  const effectiveUserId = viewAsUserId || user?.id;
  const { positions, loading: positionsLoading, sharedOwners, refetch } = usePositions(effectiveUserId);
  const { assignedPositions, closedPositions, loading: assignedLoading, refetch: refetchAssigned } = useAssignedPositions(effectiveUserId);
  
  // Auto-detect called away positions with confirmation
  const { pendingEvents, confirmCalledAway, dismissEvent } = useCalledAwayDetection(assignedPositions, refetchAssigned);
  const { settings } = useSettings(effectiveUserId);
  const { history: portfolioHistory, recordSnapshot } = usePortfolioHistory(effectiveUserId);
  
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("all");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [assignedCapitalDialogOpen, setAssignedCapitalDialogOpen] = useState(false);
  
  // FAIL-PROOF PREMIUM CALCULATION - single source of truth with time period filtering
  const { breakdown: premiumBreakdown, refetch: refetchPremiums } = usePremiumAudit(effectiveUserId, {
    timePeriod,
    customDateRange,
  });
  
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
  // Contracts expire at market close (4:00 PM ET) on expiration day
  // We consider them active through the entire expiration day
  const activePositions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return filteredPositions.filter(position => {
      // Parse expiration as local date to avoid timezone issues
      const [year, month, day] = position.expiration.split('-').map(Number);
      const expirationDate = new Date(year, month - 1, day);
      expirationDate.setHours(23, 59, 59, 999); // End of expiration day
      return expirationDate >= today;
    });
  }, [filteredPositions]);

  const expiredPositions = useMemo(() => {
    const now = new Date();
    
    // Get IDs of positions that have been assigned
    const assignedPositionIds = new Set(
      assignedPositions
        .map(ap => ap.original_position_id)
        .filter(Boolean)
    );
    
    return filteredPositions.filter(position => {
      // Parse expiration as local date to avoid timezone issues
      const [year, month, day] = position.expiration.split('-').map(Number);
      const expirationDate = new Date(year, month - 1, day);
      expirationDate.setHours(23, 59, 59, 999); // End of expiration day
      
      const isExpired = expirationDate < now;
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
      await Promise.all([refetch(), refetchPremiums()]);
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
  
  // PREMIUM CALCULATION: Use the fail-proof audit hook as the SINGLE SOURCE OF TRUTH
  // This eliminates all double-counting issues by calculating each category exactly once
  const activePremiums = premiumBreakdown?.activePutPremium ?? 0;
  const expiredPremiums = premiumBreakdown?.expiredPutPremium ?? 0;
  const assignedPutPremiums = premiumBreakdown?.assignedPutPremium ?? 0;
  const coveredCallPremiums = premiumBreakdown?.activeCallPremium ?? 0;
  const closedPutPremiums = 0; // Already included in assignedPutPremiums (no separate "closed put" category)
  const closedCallPremiums = premiumBreakdown?.closedCallPremium ?? 0;
  
  // Total premium from all sources - calculated by the audit hook, NO manual addition here
  const totalPremium = premiumBreakdown?.totalPremium ?? 0;
  
  // Capital gains from called away positions = (sold_price - assignment_price) × shares
  // This is the pure stock appreciation, NOT including premiums (which are counted separately)
  const totalCapitalGains = closedPositions.reduce((sum, p) => {
    const soldPrice = p.sold_price || 0;
    const assignmentPrice = p.assignment_price;
    const stockGain = (soldPrice - assignmentPrice) * p.shares;
    return sum + stockGain;
  }, 0);
  
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
  
  // Record portfolio snapshot when key metrics change (skip in advisor view)
  useEffect(() => {
    if (isAdvisorView || !effectiveUserId || authLoading || positionsLoading || assignedLoading) return;
    
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
  }, [effectiveUserId, totalPortfolioValue, totalPremium, assignedSharesMarketValue, totalUnrealizedPnL, isAdvisorView]);
  
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
        {!isAdvisorView && (
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
        )}

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
          <CardContent className="p-6 space-y-6">
            {/* Total Returns Hero Section */}
            <div className="rounded-xl bg-gradient-to-r from-success/10 via-success/5 to-transparent border border-success/20 p-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-success/20">
                      <TrendingUp className="h-5 w-5 text-success" />
                    </div>
                    <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Returns</span>
                  </div>
                  <div className="text-4xl font-bold text-success">
                    ${(totalPremium + totalCapitalGains).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Combined premium income + capital gains from completed wheel cycles
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4 lg:gap-8">
                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <div className="cursor-help flex-1 min-w-[160px] p-4 rounded-lg bg-background/50 border border-border/50 hover:border-success/30 transition-colors">
                        <div className="flex items-center gap-2 mb-1">
                          <DollarSign className="h-4 w-4 text-success" />
                          <span className="text-xs text-muted-foreground uppercase tracking-wider">Premium</span>
                        </div>
                        <div className="text-2xl font-bold">
                          ${totalPremium.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">All options sold</p>
                      </div>
                    </HoverCardTrigger>
                    <HoverCardContent side="bottom" align="start">
                      <TooltipHeader 
                        icon={DollarSign} 
                        iconClassName="bg-success/20"
                        title="Premium Breakdown"
                      />
                      <TooltipContainer>
                        <p className="text-xs text-muted-foreground mb-2">PUT PREMIUMS</p>
                        <TooltipRow 
                          label={`Active (${premiumBreakdown?.activePutCount ?? 0} contracts)`}
                          value={`$${activePremiums.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                        />
                        <TooltipRow 
                          label={`Expired Worthless (${premiumBreakdown?.expiredPutCount ?? 0})`}
                          value={`$${expiredPremiums.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                        />
                        <TooltipRow 
                          label={`Assigned to Stock (${premiumBreakdown?.assignedPutCount ?? 0})`}
                          value={`$${assignedPutPremiums.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                        />
                        <TooltipRow 
                          label="Subtotal Puts" 
                          value={`$${(premiumBreakdown?.totalPutPremium ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                          isTotal
                        />
                        <TooltipDivider />
                        <p className="text-xs text-muted-foreground mb-2">CALL PREMIUMS</p>
                        <TooltipRow 
                          label={`Active Covered Calls (${premiumBreakdown?.activeCallCount ?? 0})`}
                          value={`$${coveredCallPremiums.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                        />
                        <TooltipRow 
                          label={`Closed/Exercised (${premiumBreakdown?.closedCallCount ?? 0})`}
                          value={`$${closedCallPremiums.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                        />
                        <TooltipRow 
                          label="Subtotal Calls" 
                          value={`$${(premiumBreakdown?.totalCallPremium ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                          isTotal
                        />
                        <TooltipDivider />
                        <TooltipRow 
                          label="TOTAL PREMIUM" 
                          value={`$${totalPremium.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                          valueClassName="text-success font-bold"
                          isTotal
                        />
                      </TooltipContainer>
                    </HoverCardContent>
                  </HoverCard>
                  
                  <div className="hidden sm:flex items-center text-2xl font-light text-muted-foreground">+</div>
                  
                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <div className="cursor-help flex-1 min-w-[160px] p-4 rounded-lg bg-background/50 border border-border/50 hover:border-success/30 transition-colors">
                        <div className="flex items-center gap-2 mb-1">
                          <Target className="h-4 w-4 text-success" />
                          <span className="text-xs text-muted-foreground uppercase tracking-wider">Capital Gains</span>
                        </div>
                        <div className="text-2xl font-bold">
                          ${totalCapitalGains.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">Stock appreciation</p>
                      </div>
                    </HoverCardTrigger>
                    <HoverCardContent side="bottom" align="start">
                      <TooltipHeader 
                        icon={Target} 
                        iconClassName="bg-success/20"
                        title="Capital Gains Breakdown"
                      />
                      <TooltipContainer>
                        <TooltipRow 
                          label="Completed Wheel Cycles"
                          value={closedPositions.length.toString()}
                        />
                        {closedPositions.length > 0 && (
                          <>
                            <TooltipDivider />
                            <TooltipScrollArea>
                              {closedPositions.map(p => {
                                const stockGain = ((p.sold_price || 0) - p.assignment_price) * p.shares;
                                return (
                                  <TooltipPositionRow
                                    key={p.id}
                                    symbol={p.symbol}
                                    detail={`${p.shares} shares @ $${p.sold_price?.toFixed(2)}`}
                                    value={`+$${stockGain.toLocaleString('en-US', { minimumFractionDigits: 0 })}`}
                                    valueClassName="text-success"
                                    indicator="positive"
                                  />
                                );
                              })}
                            </TooltipScrollArea>
                          </>
                        )}
                        <TooltipRow 
                          label="Total Capital Gains" 
                          value={`$${totalCapitalGains.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                          valueClassName="text-success"
                          isTotal
                        />
                      </TooltipContainer>
                    </HoverCardContent>
                  </HoverCard>
                  
                  <div className="hidden sm:flex items-center text-2xl font-light text-muted-foreground">=</div>
                  
                  <div className="flex-1 min-w-[160px] p-4 rounded-lg bg-success/20 border border-success/30">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="h-4 w-4 text-success" />
                      <span className="text-xs text-success uppercase tracking-wider font-medium">Total</span>
                    </div>
                    <div className="text-2xl font-bold text-success">
                      ${(totalPremium + totalCapitalGains).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                    <p className="text-xs text-success/80 mt-0.5">Your earnings</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Metrics Grid */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              <HoverCard>
                <HoverCardTrigger asChild>
                  <div className="cursor-help">
                    <CommandPanelCard
                      label="Total Assets"
                      value={`$${(totalPortfolioValue / 1000).toFixed(1)}K`}
                      subtitle="Hover for breakdown"
                      icon={TrendingUp}
                      sparklineData={portfolioHistory.slice(-14).map(h => h.portfolio_value)}
                      sparklineColor="auto"
                    />
                  </div>
                </HoverCardTrigger>
                <HoverCardContent side="bottom" align="start">
                  <TooltipHeader 
                    icon={TrendingUp} 
                    title="Assets Breakdown"
                    badge="Live"
                    badgeVariant="success"
                  />
                  {portfolioHistory.length >= 2 && (
                    <TooltipChartWrapper label="14-Day Portfolio Trend">
                      <MiniSparkline 
                        data={portfolioHistory.slice(-14).map(h => h.portfolio_value)} 
                        color="auto"
                        height={48}
                      />
                    </TooltipChartWrapper>
                  )}
                  <TooltipContainer>
                    <TooltipRow 
                      icon={Wallet}
                      label="Cash Balance" 
                      value={`$${(settings.cash_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}`}
                    />
                    <TooltipRow 
                      icon={FileText}
                      label="Assigned Shares" 
                      value={`$${assignedSharesMarketValue.toLocaleString('en-US', { minimumFractionDigits: 0 })}`}
                    />
                    <TooltipRow 
                      icon={PiggyBank}
                      label="Other Holdings" 
                      value={`$${(settings.other_holdings_value || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}`}
                    />
                    <TooltipRow 
                      icon={BarChart3}
                      label="Unrealized P/L" 
                      value={`${totalUnrealizedPnL >= 0 ? '+' : ''}$${totalUnrealizedPnL.toLocaleString('en-US', { minimumFractionDigits: 0 })}`}
                      valueClassName={totalUnrealizedPnL >= 0 ? 'text-success' : 'text-destructive'}
                    />
                    <TooltipRow 
                      label="Total Assets" 
                      value={`$${totalPortfolioValue.toLocaleString('en-US', { minimumFractionDigits: 0 })}`}
                      valueClassName="text-primary"
                      isTotal
                    />
                  </TooltipContainer>
                </HoverCardContent>
              </HoverCard>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <div className="cursor-help">
                    <CommandPanelCard
                      label="Total Premium"
                      value={`$${totalPremium.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                      subtitle="Hover for breakdown"
                      icon={DollarSign}
                      sparklineData={portfolioHistory.slice(-14).map(h => h.total_premiums_collected)}
                      sparklineColor="hsl(var(--success))"
                    />
                  </div>
                </HoverCardTrigger>
                <HoverCardContent side="bottom" align="start">
                  <TooltipHeader 
                    icon={DollarSign} 
                    iconClassName="bg-success/20"
                    title="Premium Breakdown"
                  />
                  {portfolioHistory.length >= 2 && (
                    <TooltipChartWrapper label="Premium Collection Trend">
                      <MiniSparkline 
                        data={portfolioHistory.slice(-14).map(h => h.total_premiums_collected)} 
                        color="hsl(var(--success))"
                        height={48}
                      />
                    </TooltipChartWrapper>
                  )}
                  <TooltipContainer>
                    <TooltipRow 
                      label={`Active Puts (${activePositions.length})`}
                      value={`$${activePremiums.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                    />
                    <TooltipRow 
                      label={`Expired Puts (${expiredPositions.length})`}
                      value={`$${expiredPremiums.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                    />
                    <TooltipRow 
                      label={`Assigned Puts (${filteredAssignedPositions.length})`}
                      value={`$${assignedPutPremiums.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                    />
                    <TooltipRow 
                      label="Covered Calls"
                      value={`$${coveredCallPremiums.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                    />
                    <TooltipRow 
                      label="Total Premium" 
                      value={`$${totalPremium.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                      valueClassName="text-success"
                      isTotal
                    />
                  </TooltipContainer>
                </HoverCardContent>
              </HoverCard>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <div className="cursor-help">
                    <CommandPanelCard
                      label="Net Position P/L"
                      value={`$${totalUnrealizedPnL.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                      subtitle="Hover for breakdown"
                      icon={TrendingUp}
                      trend={{ value: `${totalUnrealizedPnL >= 0 ? '+' : ''}${totalUnrealizedPnL.toFixed(0)}`, isPositive: totalUnrealizedPnL >= 0 }}
                      sparklineData={portfolioHistory.slice(-14).map(h => h.net_position_pnl)}
                      sparklineColor="auto"
                    />
                  </div>
                </HoverCardTrigger>
                <HoverCardContent side="bottom" align="start">
                  <TooltipHeader 
                    icon={TrendingUp} 
                    iconClassName={totalUnrealizedPnL >= 0 ? "bg-success/20" : "bg-destructive/20"}
                    title="P/L by Position"
                    badge={totalUnrealizedPnL >= 0 ? "Profit" : "Loss"}
                    badgeVariant={totalUnrealizedPnL >= 0 ? "success" : "destructive"}
                  />
                  {portfolioHistory.length >= 2 && (
                    <TooltipChartWrapper label="14-Day P/L Trend">
                      <MiniSparkline 
                        data={portfolioHistory.slice(-14).map(h => h.net_position_pnl)} 
                        color="auto"
                        height={48}
                      />
                    </TooltipChartWrapper>
                  )}
                  <TooltipScrollArea>
                    {[...activePositions].sort((a, b) => b.unrealizedPnL - a.unrealizedPnL).map(p => (
                      <TooltipPositionRow
                        key={p.id}
                        symbol={p.symbol}
                        detail={`${p.contracts}x`}
                        value={`${p.unrealizedPnL >= 0 ? '+' : ''}$${p.unrealizedPnL.toLocaleString('en-US', { minimumFractionDigits: 0 })}`}
                        valueClassName={p.unrealizedPnL >= 0 ? 'text-success' : 'text-destructive'}
                        indicator={p.unrealizedPnL >= 0 ? "positive" : "negative"}
                      />
                    ))}
                    {activePositions.length === 0 && (
                      <TooltipEmptyState message="No active positions" />
                    )}
                  </TooltipScrollArea>
                  <TooltipContainer>
                    <TooltipRow 
                      label="Net P/L" 
                      value={`${totalUnrealizedPnL >= 0 ? '+' : ''}$${totalUnrealizedPnL.toLocaleString('en-US', { minimumFractionDigits: 0 })}`}
                      valueClassName={totalUnrealizedPnL >= 0 ? 'text-success' : 'text-destructive'}
                      isTotal
                    />
                  </TooltipContainer>
                </HoverCardContent>
              </HoverCard>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <div className="cursor-help" onClick={() => setAssignedCapitalDialogOpen(true)}>
                    <CommandPanelCard
                      label="Assigned Capital"
                      value={`$${assignedSharesMarketValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                      subtitle="Hover for breakdown"
                      icon={FileText}
                      sparklineData={portfolioHistory.slice(-14).map(h => h.assigned_shares_value)}
                      sparklineColor="hsl(var(--primary))"
                    />
                  </div>
                </HoverCardTrigger>
                <HoverCardContent side="bottom" align="start">
                  <TooltipHeader 
                    icon={FileText} 
                    title="Assigned Shares"
                    badge={`${filteredAssignedPositions.length} positions`}
                  />
                  <TooltipScrollArea maxHeight="max-h-32">
                    {filteredAssignedPositions.map(ap => (
                      <TooltipPositionRow
                        key={ap.id}
                        symbol={ap.symbol}
                        detail={`${ap.shares} shares`}
                        value={`$${((ap.current_price || ap.assignment_price) * ap.shares).toLocaleString('en-US', { minimumFractionDigits: 0 })}`}
                        indicator={(ap.unrealized_pnl || 0) >= 0 ? "positive" : "negative"}
                      />
                    ))}
                    {filteredAssignedPositions.length === 0 && (
                      <TooltipEmptyState message="No assigned positions" />
                    )}
                  </TooltipScrollArea>
                  <TooltipDivider />
                  <TooltipContainer>
                    <TooltipRow 
                      label="Cost Basis" 
                      value={`$${assignedSharesCostBasis.toLocaleString('en-US', { minimumFractionDigits: 0 })}`}
                    />
                    <TooltipRow 
                      label="Market Value" 
                      value={`$${assignedSharesMarketValue.toLocaleString('en-US', { minimumFractionDigits: 0 })}`}
                    />
                    <TooltipRow 
                      label="Unrealized P/L" 
                      value={`${assignedSharesUnrealizedPnL >= 0 ? '+' : ''}$${assignedSharesUnrealizedPnL.toLocaleString('en-US', { minimumFractionDigits: 0 })}`}
                      valueClassName={assignedSharesUnrealizedPnL >= 0 ? 'text-success' : 'text-destructive'}
                      isTotal
                    />
                  </TooltipContainer>
                </HoverCardContent>
              </HoverCard>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <div className="cursor-help">
                    <CommandPanelCard
                      label="Cash Secured"
                      value={`$${cashSecured.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                      subtitle="Hover for breakdown"
                      icon={Calendar}
                      sparklineData={portfolioHistory.slice(-14).map(h => h.positions_value)}
                      sparklineColor="hsl(var(--muted-foreground))"
                    />
                  </div>
                </HoverCardTrigger>
                <HoverCardContent side="bottom" align="start">
                  <TooltipHeader 
                    icon={Target} 
                    title="Cash Secured"
                    badge={`${activeContracts} contracts`}
                  />
                  <TooltipScrollArea>
                    {activePositions.map(p => (
                      <TooltipPositionRow
                        key={p.id}
                        symbol={p.symbol}
                        detail={`${p.contracts}x $${p.strikePrice}`}
                        value={`$${(p.strikePrice * 100 * p.contracts).toLocaleString('en-US', { minimumFractionDigits: 0 })}`}
                        indicator="neutral"
                      />
                    ))}
                    {activePositions.length === 0 && (
                      <TooltipEmptyState message="No active positions" />
                    )}
                  </TooltipScrollArea>
                  <TooltipContainer>
                    <TooltipRow 
                      label={`Total Secured`}
                      value={`$${cashSecured.toLocaleString('en-US', { minimumFractionDigits: 0 })}`}
                      valueClassName="text-primary"
                      isTotal
                    />
                  </TooltipContainer>
                </HoverCardContent>
              </HoverCard>
              <CommandPanelCard
                label="Available Cash"
                value={`$${(availableCash / 1000).toFixed(1)}K`}
                subtitle="Liquid capital"
                icon={DollarSign}
                sparklineData={portfolioHistory.slice(-14).map(h => h.cash_balance)}
                sparklineColor="hsl(var(--primary))"
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
              <HoverCard>
                <HoverCardTrigger asChild>
                  <div className="cursor-help">
                    <CommandPanelCard
                      label="At-Risk"
                      value={atRiskCount.toString()}
                      subtitle="Hover for details"
                      icon={AlertTriangle}
                      sparklineColor="hsl(var(--destructive))"
                    />
                  </div>
                </HoverCardTrigger>
                <HoverCardContent side="bottom" align="end">
                  <TooltipHeader 
                    icon={AlertTriangle} 
                    iconClassName="bg-destructive/20"
                    title="At-Risk Positions"
                    badge={atRiskCount > 0 ? `${atRiskCount} warning${atRiskCount > 1 ? 's' : ''}` : "All clear"}
                    badgeVariant={atRiskCount > 0 ? "destructive" : "success"}
                  />
                  <TooltipScrollArea>
                    {activePositions.filter(p => p.pctAboveStrike < 5).map(p => (
                      <TooltipPositionRow
                        key={p.id}
                        symbol={p.symbol}
                        detail={`$${p.strikePrice} strike`}
                        value={`${p.pctAboveStrike >= 0 ? '+' : ''}${p.pctAboveStrike.toFixed(1)}%`}
                        valueClassName={p.pctAboveStrike < 0 ? 'text-destructive' : 'text-warning'}
                        indicator={p.pctAboveStrike < 0 ? "negative" : "warning"}
                      />
                    ))}
                    {atRiskCount === 0 && (
                      <TooltipEmptyState message="No at-risk positions" />
                    )}
                  </TooltipScrollArea>
                </HoverCardContent>
              </HoverCard>
              
              {/* Assets Trend Chart - spans multiple columns */}
              <AssetsTrendChart currentValue={totalPortfolioValue} history={portfolioHistory} />
            </div>
          </CardContent>
        </Card>

        {/* Import Bar - hide in advisor view */}
        {!isAdvisorView && <ImportBar />}

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
        <div id="positions" className="scroll-mt-6 space-y-0">
          <ActivePositionsBatchHeader positions={activePositions} />
          
          <Card>
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
        </div>

        {/* Assigned Positions Zone */}
        <Card id="assignments" className="scroll-mt-6">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-lg">Assigned Positions Zone</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <AssignedPositionsTable positions={filteredAssignedPositions} onRefetch={refetchAssigned} />
          </CardContent>
        </Card>

        {/* Called Away Positions (Completed Wheel Cycles) */}
        {closedPositions.length > 0 && (
          <CalledAwayPositions positions={closedPositions} />
        )}

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

        {/* Learning Center - hide in advisor view */}
        {!isAdvisorView && <LearningCenter />}
      </div>

      {/* Assigned Capital Dialog */}
      <AssignedCapitalDialog
        open={assignedCapitalDialogOpen}
        onOpenChange={setAssignedCapitalDialogOpen}
        assignedPositions={filteredAssignedPositions}
        totalAssignedCapital={assignedSharesMarketValue}
      />

      {/* Called Away Confirmation Dialog */}
      <CalledAwayConfirmDialog
        pendingEvents={pendingEvents}
        onConfirm={confirmCalledAway}
        onDismiss={dismissEvent}
      />

      {/* First-time user guide */}
      {showGuide && !isAdvisorView && (
        <FirstTimeUserGuide
          userRole={userRole}
          onDismiss={dismissGuide}
          onNavigate={(path) => navigate(path)}
        />
      )}
    </div>
  );
};

export default Dashboard;
