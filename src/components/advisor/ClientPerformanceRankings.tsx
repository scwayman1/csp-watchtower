import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, TrendingUp, TrendingDown, Minus, ChevronRight } from "lucide-react";

interface ClientPerformance {
  id: string;
  name: string;
  premiumYTD: number;
  premiumAllTime: number;
  contributionPct: number;
  ytdReturn: number | null;
}

export function ClientPerformanceRankings() {
  const [, setSearchParams] = useSearchParams();

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

  // Fetch positions for all clients (include expiration and id for proper filtering)
  const { data: positions } = useQuery({
    queryKey: ["advisor-client-positions-rankings", clientUserIds],
    queryFn: async () => {
      if (clientUserIds.length === 0) return [];
      const { data, error } = await supabase
        .from("positions")
        .select("id, user_id, premium_per_contract, contracts, expiration")
        .in("user_id", clientUserIds);
      if (error) throw error;
      return data || [];
    },
    enabled: clientUserIds.length > 0,
  });

  // Fetch assigned positions (include original_position_id to avoid double-counting)
  const { data: assignedPositions } = useQuery({
    queryKey: ["advisor-client-assigned-rankings", clientUserIds],
    queryFn: async () => {
      if (clientUserIds.length === 0) return [];
      const { data, error } = await supabase
        .from("assigned_positions")
        .select("user_id, original_put_premium, id, original_position_id")
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

  // Build set of position IDs that became assigned (to avoid double-counting)
  const assignedPositionIds = new Set(
    (assignedPositions || [])
      .map(ap => ap.original_position_id)
      .filter(Boolean)
  );

  const today = new Date().toISOString().split('T')[0];

  // Calculate performance per client using same logic as usePremiumAudit
  const performances: ClientPerformance[] = (clients || [])
    .filter(c => c.user_id)
    .map(client => {
      const userId = client.user_id!;
      
      // Get client's positions
      const clientPositions = (positions || []).filter(p => p.user_id === userId);
      
      // Active put premium (not expired)
      const activePutPremium = clientPositions
        .filter(p => p.expiration >= today)
        .reduce((sum, p) => sum + parseFloat(String(p.premium_per_contract)) * parseFloat(String(p.contracts)) * 100, 0);
      
      // Expired put premium (expired but NOT assigned - to avoid double-counting)
      const expiredPutPremium = clientPositions
        .filter(p => p.expiration < today && !assignedPositionIds.has(p.id))
        .reduce((sum, p) => sum + parseFloat(String(p.premium_per_contract)) * parseFloat(String(p.contracts)) * 100, 0);

      // Assigned put premium (from assigned_positions table)
      const clientAssigned = (assignedPositions || []).filter(ap => ap.user_id === userId);
      const assignedPutPremium = clientAssigned.reduce((sum, ap) => 
        sum + parseFloat(String(ap.original_put_premium || 0)), 0);

      // Covered call premiums
      const clientAssignedIds = clientAssigned.map(ap => ap.id);
      const clientCalls = (coveredCalls || []).filter(cc => clientAssignedIds.includes(cc.assigned_position_id));
      const callPremium = clientCalls.reduce((sum, cc) => 
        sum + parseFloat(String(cc.premium_per_contract)) * parseFloat(String(cc.contracts)) * 100, 0);

      // Total Premium = active puts + expired puts + assigned puts + calls (no double-counting)
      const totalPremium = activePutPremium + expiredPutPremium + assignedPutPremium + callPremium;

      // Calculate AUM for YTD return
      const settings = (userSettings || []).find(s => s.user_id === userId);
      const cashBalance = parseFloat(String(settings?.cash_balance || 0));
      const otherHoldings = parseFloat(String(settings?.other_holdings_value || 0));
      const clientAUM = cashBalance + otherHoldings;
      
      const ytdReturn = clientAUM > 0 ? (totalPremium / clientAUM) * 100 : null;

      return {
        id: client.id,
        name: client.name,
        premiumYTD: totalPremium, // This is now Total Premium (all-time)
        premiumAllTime: totalPremium,
        contributionPct: 0, // Will calculate after
        ytdReturn,
      };
    });

  // Calculate total premium for contribution percentages
  const totalPremiumAllTime = performances.reduce((sum, p) => sum + p.premiumAllTime, 0);
  performances.forEach(p => {
    p.contributionPct = totalPremiumAllTime > 0 ? (p.premiumAllTime / totalPremiumAllTime) * 100 : 0;
  });

  // Sort by total premium (descending)
  const ranked = [...performances].sort((a, b) => b.premiumAllTime - a.premiumAllTime);

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
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-warning" />
            Client Performance
          </CardTitle>
          <span className="text-xs text-muted-foreground">Total Premium</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {ranked.map((client, index) => {
          const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : null;
          
          return (
            <button
              key={client.id}
              onClick={() => setSearchParams({ client: client.id })}
              type="button"
              className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 flex items-center justify-center text-lg font-bold">
                  {medal || <span className="text-sm text-muted-foreground">#{index + 1}</span>}
                </div>
                <div>
                  <p className="font-medium group-hover:text-primary transition-colors">{client.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {client.contributionPct.toFixed(1)}% of total premium
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(client.premiumAllTime)}</p>
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
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
