import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, DollarSign, Activity } from "lucide-react";
import { ProfileViewer } from "@/components/advisor/ProfileViewer";
import { ClientFilter } from "@/components/advisor/ClientFilter";
import Dashboard from "@/pages/Dashboard";

interface AdvisorStats {
  totalClients: number;
  activeClients: number;
  totalAUM: number;
  activeCycles: number;
  totalPremiumYTD?: number;
}

export default function AdvisorDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(
    searchParams.get("client")
  );
  const [stats, setStats] = useState<AdvisorStats>({
    totalClients: 0,
    activeClients: 0,
    totalAUM: 0,
    activeCycles: 0,
  });
  const [loading, setLoading] = useState(true);

  const handleClientSelect = (clientId: string | null) => {
    setSelectedClientId(clientId);
    if (clientId) {
      setSearchParams({ client: clientId });
    } else {
      setSearchParams({});
    }
  };

  useEffect(() => {
    fetchAdvisorStats();
  }, []);

  const fetchAdvisorStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch clients
      const { data: clients } = await supabase
        .from("clients")
        .select("*")
        .eq("advisor_id", user.id);

      // Fetch active cycles
      const { data: cycles } = await supabase
        .from("cycles")
        .select("*")
        .eq("advisor_id", user.id)
        .in("status", ["DRAFT", "PUBLISHED"]);

      const totalClients = clients?.length || 0;
      const activeClients = clients?.filter(c => c.open_csp_count > 0).length || 0;
      const totalAUM = clients?.reduce((sum, c) => sum + (c.portfolio_value || 0), 0) || 0;
      const totalPremiumYTD = clients?.reduce((sum, c) => sum + (c.premium_ytd || 0), 0) || 0;
      const activeCycles = cycles?.length || 0;

      setStats({
        totalClients,
        activeClients,
        totalAUM,
        activeCycles,
        totalPremiumYTD,
      });
    } catch (error) {
      console.error("Error fetching advisor stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "Total Clients",
      value: stats.totalClients,
      icon: Users,
      description: `${stats.activeClients} active`,
    },
    {
      title: "Assets Under Management",
      value: `$${(stats.totalAUM / 1000000).toFixed(2)}M`,
      icon: DollarSign,
      description: "Total client portfolios",
    },
    {
      title: "Active Cycles",
      value: stats.activeCycles,
      icon: Activity,
      description: "Current trading cycles",
    },
    {
      title: "Client Premium YTD",
      value: `$${(stats.totalPremiumYTD || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: TrendingUp,
      description: "Total premiums collected",
    },
  ];

  if (loading) {
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
          return (
            <Card key={stat.title} className="bg-card/50 border-border/50 hover:bg-card/80 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button 
              onClick={() => navigate('/advisor/cycle-sheet')}
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
              onClick={() => navigate('/advisor/cycle-sheet')}
              className="p-4 border border-border/50 rounded-lg hover:bg-accent/50 transition-colors text-left"
            >
              <h3 className="font-semibold mb-1">Upload CycleSheet</h3>
              <p className="text-sm text-muted-foreground">Import trades from spreadsheet</p>
            </button>
          </div>
        </CardContent>
      </Card>

      <ProfileViewer />
    </div>
  );
}
