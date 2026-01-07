import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, DollarSign, Activity, ArrowUpRight, ArrowDownRight, PieChart } from "lucide-react";
import { ClientFilter } from "@/components/advisor/ClientFilter";
import { FirstTimeUserGuide } from "@/components/onboarding/FirstTimeUserGuide";
import { AdvisorSetupChecklist } from "@/components/onboarding/AdvisorSetupChecklist";
import { useOnboarding } from "@/hooks/useOnboarding";
import Dashboard from "@/pages/Dashboard";
import { ClientLearningInsightsWidget } from "@/components/advisor/ClientLearningInsightsWidget";
import { useAdvisorMetrics } from "@/hooks/useAdvisorMetrics";

export default function AdvisorDashboard() {
  const navigate = useNavigate();
  const { showGuide, dismissGuide } = useOnboarding();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(
    searchParams.get("client")
  );

  // Use centralized metrics hook for accurate data
  const metrics = useAdvisorMetrics();

  const handleClientSelect = (clientId: string | null) => {
    setSelectedClientId(clientId);
    if (clientId) {
      setSearchParams({ client: clientId });
    } else {
      setSearchParams({});
    }
  };

  // Fetch client data when selected
  const { data: selectedClient } = useQuery({
    queryKey: ["selected-client", selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return null;
      
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", selectedClientId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!selectedClientId,
  });

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPct = (value: number | null) => {
    if (value === null) return null;
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const statCards = [
    {
      title: "Total Clients",
      value: metrics.totalClients,
      icon: Users,
      description: `${metrics.activeClients} active`,
    },
    {
      title: "Assets Under Management",
      value: formatCurrency(metrics.totalAUM),
      icon: DollarSign,
      description: metrics.ytdGrowthPct !== null 
        ? `${formatPct(metrics.ytdGrowthPct)} YTD return` 
        : "Total client portfolios",
      badge: metrics.ytdGrowthPct,
    },
    {
      title: "Premium YTD",
      value: formatCurrency(metrics.totalPremiumYTD),
      icon: TrendingUp,
      description: `${formatCurrency(metrics.totalPremiumAllTime)} all-time`,
      badge: metrics.momGrowthPct,
      badgeLabel: "MoM",
    },
    {
      title: "Premium MTD",
      value: formatCurrency(metrics.totalPremiumMTD),
      icon: Activity,
      description: `${formatCurrency(metrics.totalPremiumLastMonth)} last month`,
    },
  ];

  if (metrics.isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-64"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-muted rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // If a client is selected, show their full dashboard
  if (selectedClientId && selectedClient?.user_id) {
    return (
      <div className="space-y-4">
        <div className="px-6 pt-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{selectedClient.name}'s Dashboard</h1>
            <p className="text-sm text-muted-foreground">{selectedClient.email}</p>
          </div>
          <ClientFilter
            selectedClientId={selectedClientId}
            onClientSelect={handleClientSelect}
          />
        </div>
        <Dashboard viewAsUserId={selectedClient.user_id} isAdvisorView />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
            Advisor Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage clients, cycles, and model trades
          </p>
        </div>
        <ClientFilter
          selectedClientId={selectedClientId}
          onClientSelect={setSelectedClientId}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          const hasBadge = 'badge' in stat && stat.badge !== null && stat.badge !== undefined;
          const isPositive = hasBadge && (stat.badge as number) >= 0;
          return (
            <Card key={stat.title} className="bg-card/50 border-border/50 hover:bg-card/80 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{stat.value}</span>
                  {hasBadge && (
                    <span className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded ${
                      isPositive ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
                    }`}>
                      {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {formatPct(stat.badge as number)}
                      {'badgeLabel' in stat && <span className="ml-0.5 opacity-70">{stat.badgeLabel}</span>}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Setup Checklist for new advisors */}
      <AdvisorSetupChecklist />

      {/* Premium Breakdown Card */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Premium Breakdown (All-Time)</CardTitle>
          <PieChart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {(() => {
            const { puts, assignedPuts, coveredCalls } = metrics.premiumBreakdown;
            const total = puts + assignedPuts + coveredCalls;
            const putsPercent = total > 0 ? (puts / total) * 100 : 0;
            const assignedPercent = total > 0 ? (assignedPuts / total) * 100 : 0;
            const callsPercent = total > 0 ? (coveredCalls / total) * 100 : 0;

            return (
              <div className="space-y-4">
                {/* Visual bar */}
                <div className="h-3 w-full rounded-full overflow-hidden flex bg-muted">
                  {putsPercent > 0 && (
                    <div 
                      className="h-full bg-primary transition-all" 
                      style={{ width: `${putsPercent}%` }}
                    />
                  )}
                  {assignedPercent > 0 && (
                    <div 
                      className="h-full bg-warning transition-all" 
                      style={{ width: `${assignedPercent}%` }}
                    />
                  )}
                  {callsPercent > 0 && (
                    <div 
                      className="h-full bg-success transition-all" 
                      style={{ width: `${callsPercent}%` }}
                    />
                  )}
                </div>

                {/* Legend with values */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-primary" />
                      <span className="text-xs text-muted-foreground">Active Puts</span>
                    </div>
                    <p className="text-lg font-semibold">{formatCurrency(puts)}</p>
                    <p className="text-xs text-muted-foreground">{putsPercent.toFixed(1)}%</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-warning" />
                      <span className="text-xs text-muted-foreground">Assigned Puts</span>
                    </div>
                    <p className="text-lg font-semibold">{formatCurrency(assignedPuts)}</p>
                    <p className="text-xs text-muted-foreground">{assignedPercent.toFixed(1)}%</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-success" />
                      <span className="text-xs text-muted-foreground">Covered Calls</span>
                    </div>
                    <p className="text-lg font-semibold">{formatCurrency(coveredCalls)}</p>
                    <p className="text-xs text-muted-foreground">{callsPercent.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Client Learning Insights */}
        <ClientLearningInsightsWidget />

        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4">
              <button 
                onClick={() => navigate('/advisor/cyclesheet')}
                className="p-4 border border-border/50 rounded-lg hover:bg-accent/50 transition-colors text-left"
              >
                <h3 className="font-semibold mb-1">Create New Cycle</h3>
                <p className="text-sm text-muted-foreground">Start a new trading cycle</p>
              </button>
              <button 
                onClick={() => navigate('/advisor/clients')}
                className="p-4 border border-border/50 rounded-lg hover:bg-accent/50 transition-colors text-left"
              >
                <h3 className="font-semibold mb-1">Add Client</h3>
                <p className="text-sm text-muted-foreground">Onboard a new client</p>
              </button>
              <button 
                onClick={() => navigate('/advisor/cyclesheet')}
                className="p-4 border border-border/50 rounded-lg hover:bg-accent/50 transition-colors text-left"
              >
                <h3 className="font-semibold mb-1">Upload CycleSheet</h3>
                <p className="text-sm text-muted-foreground">Import trades from spreadsheet</p>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* First-time advisor guide */}
      {showGuide && (
        <FirstTimeUserGuide
          userRole="advisor"
          onDismiss={dismissGuide}
          onNavigate={(path) => navigate(path)}
        />
      )}
    </div>
  );
}
