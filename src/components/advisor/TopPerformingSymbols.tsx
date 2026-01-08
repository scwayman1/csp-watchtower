import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp } from "lucide-react";

export function TopPerformingSymbols() {
  const { data: clientUserIds = [] } = useQuery({
    queryKey: ['advisor-client-user-ids'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data: clients } = await supabase
        .from('clients')
        .select('user_id')
        .eq('advisor_id', user.id)
        .eq('invite_status', 'ACCEPTED')
        .not('user_id', 'is', null);
      
      return (clients || []).map(c => c.user_id).filter(Boolean) as string[];
    },
  });

  const { data: positions = [] } = useQuery({
    queryKey: ['advisor-all-positions-symbols', clientUserIds],
    queryFn: async () => {
      if (clientUserIds.length === 0) return [];
      const { data } = await supabase
        .from('positions')
        .select('symbol, contracts, premium_per_contract')
        .in('user_id', clientUserIds);
      return data || [];
    },
    enabled: clientUserIds.length > 0,
  });

  const { data: assignedPositions = [] } = useQuery({
    queryKey: ['advisor-all-assigned-symbols', clientUserIds],
    queryFn: async () => {
      if (clientUserIds.length === 0) return [];
      const { data } = await supabase
        .from('assigned_positions')
        .select('id, symbol, original_put_premium, shares');
      
      // Filter by user_id client-side since we need to check against our list
      return data || [];
    },
    enabled: clientUserIds.length > 0,
  });

  const { data: coveredCalls = [] } = useQuery({
    queryKey: ['advisor-all-covered-calls-symbols', clientUserIds],
    queryFn: async () => {
      if (clientUserIds.length === 0) return [];
      const { data } = await supabase
        .from('covered_calls')
        .select('assigned_position_id, contracts, premium_per_contract');
      return data || [];
    },
    enabled: clientUserIds.length > 0,
  });

  // Build symbol premium map
  const symbolPremiums: Record<string, number> = {};

  // Add put premiums from positions
  positions.forEach(pos => {
    const symbol = pos.symbol;
    const premium = Number(pos.contracts || 1) * Number(pos.premium_per_contract || 0) * 100;
    symbolPremiums[symbol] = (symbolPremiums[symbol] || 0) + premium;
  });

  // Create map of assigned position id to symbol
  const assignedIdToSymbol: Record<string, string> = {};
  assignedPositions.forEach(ap => {
    assignedIdToSymbol[ap.id] = ap.symbol;
  });

  // Add covered call premiums
  coveredCalls.forEach(cc => {
    const symbol = assignedIdToSymbol[cc.assigned_position_id];
    if (symbol) {
      const premium = Number(cc.contracts || 1) * Number(cc.premium_per_contract || 0) * 100;
      symbolPremiums[symbol] = (symbolPremiums[symbol] || 0) + premium;
    }
  });

  // Sort by premium and take top 5
  const topSymbols = Object.entries(symbolPremiums)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const maxPremium = topSymbols.length > 0 ? topSymbols[0][1] : 1;

  const isLoading = clientUserIds.length === 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Top Performing Symbols
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : topSymbols.length === 0 ? (
          <p className="text-sm text-muted-foreground">No premium data available</p>
        ) : (
          <div className="space-y-3">
            {topSymbols.map(([symbol, premium], index) => (
              <div key={symbol} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{symbol}</span>
                  <span className="text-muted-foreground">
                    ${premium.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${(premium / maxPremium) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
