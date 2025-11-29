import { useState, useMemo } from "react";
import { StatCard } from "@/components/dashboard/StatCard";
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
    return filteredPositions.filter(position => {
      const expirationDate = new Date(position.expiration);
      return expirationDate < today;
    });
  }, [filteredPositions]);

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
  
  // Calculate portfolio stats (use active + expired positions, plus assigned premiums)
  const activePremiums = activePositions.reduce((sum, p) => sum + p.totalPremium, 0);
  const expiredPremiums = expiredPositions.reduce((sum, p) => sum + p.totalPremium, 0);
  const assignedPremiums = filteredAssignedPositions.reduce((sum, p) => sum + p.original_put_premium, 0);
  const totalPremium = activePremiums + expiredPremiums + assignedPremiums;
  
  const totalUnrealizedPnL = activePositions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
  const activeContracts = activePositions.reduce((sum, p) => sum + p.contracts, 0);
  const atRiskCount = activePositions.filter(p => p.pctAboveStrike < 5).length;
  const cashSecured = activePositions.reduce((sum, p) => sum + (p.strikePrice * 100 * p.contracts), 0);
  
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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Cash-Secured Put Tracker</h1>
            <p className="text-sm sm:text-base text-foreground/70 mt-1">
              Monitor your positions with real-time risk metrics and assignment probabilities
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <TrendingUp className="h-4 w-4 text-foreground/70" />
              <span className="text-xs sm:text-sm text-foreground/70">
                Using <Badge variant="outline" className="ml-1 text-xs">{getModelDisplayName(settings.probability_model)}</Badge> probability model
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              onClick={handleRefreshMarketData} 
              disabled={refreshing}
              size="sm"
              className="flex-1 sm:flex-none"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh Prices</span>
              <span className="sm:hidden">Refresh</span>
            </Button>
            <Button 
              variant="outline" 
              onClick={exportToCSV} 
              disabled={activePositions.length === 0}
              size="sm"
              className="flex-1 sm:flex-none"
            >
              <Download className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Export CSV</span>
              <span className="sm:hidden">Export</span>
            </Button>
            <Button 
              variant="outline" 
              onClick={signOut}
              size="sm"
              className="flex-1 sm:flex-none"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
              <span className="sm:hidden">Out</span>
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

        {/* Portfolio Summary Cards */}
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatCard
            title="Total Premium Collected"
            value={`$${totalPremium.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            subtitle="Across all positions"
            icon={DollarSign}
          />
          <StatCard
            title="Cash Secured"
            value={`$${cashSecured.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            subtitle="Total capital reserved"
            icon={TrendingUp}
          />
          <StatCard
            title="Active Contracts"
            value={activeContracts.toString()}
            subtitle={`${activePositions.length} positions`}
            icon={FileText}
          />
          <StatCard
            title="Next Expiration"
            value={nextExp ? `${nextExp.daysToExp} days` : "—"}
            subtitle={nextExp?.expiration}
            icon={Calendar}
          />
          <StatCard
            title="At-Risk Positions"
            value={atRiskCount.toString()}
            subtitle="< 5% above strike"
            icon={AlertTriangle}
            badgeVariant={atRiskCount > 0 ? "destructive" : "success"}
            badgeLabel={atRiskCount > 0 ? "ALERT" : "SAFE"}
          />
        </div>

        {/* Import Bar */}
        <ImportBar />

        {/* Filters */}
        <FiltersToolbar
          onSearchChange={() => {}}
          onRiskBandChange={() => {}}
          onExpirationChange={() => {}}
        />

        {/* Performance Analytics */}
        <PerformanceMetrics positions={activePositions} />

        {/* AI Performance Tracking */}
        <AIPerformanceTracker />

        {/* Expiration Calendar */}
        <ExpirationCalendar positions={activePositions} />

        {/* Active Positions Table */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Active Positions</h2>
          {activePositions.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                No active positions found for the selected time period.
              </CardContent>
            </Card>
          ) : (
            <PositionsTable 
              positions={activePositions} 
              onRefetch={refetch}
              onRefetchAssigned={refetchAssigned}
            />
          )}
        </div>

        {/* Assigned Positions Section */}
        <div>
          <AssignedPositionsTable positions={filteredAssignedPositions} onRefetch={refetchAssigned} />
        </div>

        {/* History - Expired Positions */}
        {expiredPositions.length > 0 && (
          <HistoryExpiredBatches 
            positions={expiredPositions} 
            onRefetch={refetch}
            onRefetchAssigned={refetchAssigned}
          />
        )}

        {/* Learning Center */}
        <LearningCenter />
      </div>
    </div>
  );
};

export default Dashboard;
