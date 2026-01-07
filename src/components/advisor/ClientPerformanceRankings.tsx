import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { startOfYear } from "date-fns";

interface ClientPerformance {
  id: string;
  name: string;
  premiumYTD: number;
  premiumAllTime: number;
  contributionPct: number;
  ytdReturn: number | null;
}

export function ClientPerformanceRankings() {
  const yearStart = startOfYear(new Date()).toISOString();

  // Get current advisor's clients
  const { data: clients } = useQuery({
    queryKey: ["advisor-clients-rankings"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("clients")
        .select("id, user_id, name")
        .eq("advisor_id", user.id)
        .eq("invite_status", "ACCEPTED");
      
      if (error) throw error;
      return data || [];
    },
  });

  const clientUserIds = (clients || [])
    .map(c => c.user_id)
    .filter((id): id is string => id !== null);

  // Fetch positions for all clients
  const { data: positions } = useQuery({
    queryKey: ["advisor-client-positions-rankings", clientUserIds],
    queryFn: async () => {
      if (clientUserIds.length === 0) return [];
      const { data, error } = await supabase
        .from("positions")
        .select("user_id, premium_per_contract, contracts, opened_at")
        .in("user_id", clientUserIds);
      if (error) throw error;
      return data || [];
    },
    enabled: clientUserIds.length > 0,
  });

  // Fetch assigned positions
  const { data: assignedPositions } = useQuery({
    queryKey: ["advisor-client-assigned-rankings", clientUserIds],
    queryFn: async () => {
      if (clientUserIds.length === 0) return [];
      const { data, error } = await supabase
        .from("assigned_positions")
        .select("user_id, original_put_premium, assignment_date, id")
        .in("user_id", clientUserIds);
      if (error) throw error;
      return data || [];
    },
    enabled: clientUserIds.length > 0,
  });

  const assignedIds = (assignedPositions || []).map(ap => ap.id);

  // Fetch covered calls
  const { data: coveredCalls } = useQuery({
    queryKey: ["advisor-client-calls-rankings", assignedIds],
    queryFn: async () => {
      if (assignedIds.length === 0) return [];
      const { data, error } = await supabase
        .from("covered_calls")
        .select("assigned_position_id, premium_per_contract, contracts, opened_at")
        .in("assigned_position_id", assignedIds);
      if (error) throw error;
      return data || [];
    },
    enabled: assignedIds.length > 0,
  });

  // Fetch user settings for AUM
  const { data: userSettings } = useQuery({
    queryKey: ["advisor-client-settings-rankings", clientUserIds],
    queryFn: async () => {
      if (clientUserIds.length === 0) return [];
      const { data, error } = await supabase
        .from("user_settings")
        .select("user_id, cash_balance, other_holdings_value")
        .in("user_id", clientUserIds);
      if (error) throw error;
      return data || [];
    },
    enabled: clientUserIds.length > 0,
  });

  // Build assigned position to user mapping
  const assignedToUser = new Map<string, string>();
  (assignedPositions || []).forEach(ap => {
    assignedToUser.set(ap.id, ap.user_id);
  });

  // Calculate performance per client
  const performances: ClientPerformance[] = (clients || [])
    .filter(c => c.user_id)
    .map(client => {
      const userId = client.user_id!;
      
      // Position premiums
      const clientPositions = (positions || []).filter(p => p.user_id === userId);
      const positionPremiumAll = clientPositions.reduce((sum, p) => 
        sum + parseFloat(String(p.premium_per_contract)) * parseFloat(String(p.contracts)) * 100, 0);
      const positionPremiumYTD = clientPositions
        .filter(p => p.opened_at >= yearStart)
        .reduce((sum, p) => sum + parseFloat(String(p.premium_per_contract)) * parseFloat(String(p.contracts)) * 100, 0);

      // Assigned premiums
      const clientAssigned = (assignedPositions || []).filter(ap => ap.user_id === userId);
      const assignedPremiumAll = clientAssigned.reduce((sum, ap) => 
        sum + parseFloat(String(ap.original_put_premium)), 0);
      const assignedPremiumYTD = clientAssigned
        .filter(ap => ap.assignment_date >= yearStart)
        .reduce((sum, ap) => sum + parseFloat(String(ap.original_put_premium)), 0);

      // Covered call premiums
      const clientAssignedIds = clientAssigned.map(ap => ap.id);
      const clientCalls = (coveredCalls || []).filter(cc => clientAssignedIds.includes(cc.assigned_position_id));
      const callsPremiumAll = clientCalls.reduce((sum, cc) => 
        sum + parseFloat(String(cc.premium_per_contract)) * parseFloat(String(cc.contracts)) * 100, 0);
      const callsPremiumYTD = clientCalls
        .filter(cc => cc.opened_at >= yearStart)
        .reduce((sum, cc) => sum + parseFloat(String(cc.premium_per_contract)) * parseFloat(String(cc.contracts)) * 100, 0);

      const premiumAllTime = positionPremiumAll + assignedPremiumAll + callsPremiumAll;
      const premiumYTD = positionPremiumYTD + assignedPremiumYTD + callsPremiumYTD;

      // Calculate AUM for YTD return
      const settings = (userSettings || []).find(s => s.user_id === userId);
      const cashBalance = parseFloat(String(settings?.cash_balance || 0));
      const otherHoldings = parseFloat(String(settings?.other_holdings_value || 0));
      const clientAUM = cashBalance + otherHoldings + premiumAllTime;
      
      const ytdReturn = clientAUM > 0 ? (premiumYTD / clientAUM) * 100 : null;

      return {
        id: client.id,
        name: client.name,
        premiumYTD,
        premiumAllTime,
        contributionPct: 0, // Will calculate after
        ytdReturn,
      };
    });

  // Calculate total premium for contribution percentages
  const totalPremiumAllTime = performances.reduce((sum, p) => sum + p.premiumAllTime, 0);
  performances.forEach(p => {
    p.contributionPct = totalPremiumAllTime > 0 ? (p.premiumAllTime / totalPremiumAllTime) * 100 : 0;
  });

  // Sort by premium YTD (descending)
  const ranked = [...performances].sort((a, b) => b.premiumYTD - a.premiumYTD);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  if (ranked.length === 0) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-warning" />
            Client Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No active clients yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-warning" />
          Client Performance Rankings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {ranked.map((client, index) => {
          const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : null;
          
          return (
            <div 
              key={client.id} 
              className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 flex items-center justify-center text-lg font-bold">
                  {medal || <span className="text-sm text-muted-foreground">#{index + 1}</span>}
                </div>
                <div>
                  <p className="font-medium">{client.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {client.contributionPct.toFixed(1)}% of total premium
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatCurrency(client.premiumYTD)}</p>
                <div className="flex items-center justify-end gap-1 text-xs">
                  {client.ytdReturn !== null ? (
                    <>
                      {client.ytdReturn > 0 ? (
                        <TrendingUp className="h-3 w-3 text-success" />
                      ) : client.ytdReturn < 0 ? (
                        <TrendingDown className="h-3 w-3 text-destructive" />
                      ) : (
                        <Minus className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className={client.ytdReturn >= 0 ? "text-success" : "text-destructive"}>
                        {client.ytdReturn >= 0 ? "+" : ""}{client.ytdReturn.toFixed(1)}% YTD
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">N/A</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
