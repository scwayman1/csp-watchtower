import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SymbolStats {
  premium: number;
  clientCount: number;
  tradeCount: number;
}

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
        .select('symbol, contracts, premium_per_contract, user_id')
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
        .select('id, symbol, original_put_premium, shares, user_id')
        .in('user_id', clientUserIds);
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

  // Build symbol stats map
  const symbolStats: Record<string, SymbolStats> = {};
  const symbolClients: Record<string, Set<string>> = {};

  // Helper to init symbol
  const initSymbol = (symbol: string) => {
    if (!symbolStats[symbol]) {
      symbolStats[symbol] = { premium: 0, clientCount: 0, tradeCount: 0 };
      symbolClients[symbol] = new Set();
    }
  };

  // Add put premiums from positions
  positions.forEach(pos => {
    const symbol = pos.symbol;
    initSymbol(symbol);
    const premium = Number(pos.contracts || 1) * Number(pos.premium_per_contract || 0) * 100;
    symbolStats[symbol].premium += premium;
    symbolStats[symbol].tradeCount += 1;
    if (pos.user_id) symbolClients[symbol].add(pos.user_id);
  });

  // Create map of assigned position id to symbol and user_id
  const assignedIdToData: Record<string, { symbol: string; user_id: string | null }> = {};
  assignedPositions.forEach(ap => {
    assignedIdToData[ap.id] = { symbol: ap.symbol, user_id: ap.user_id };
  });

  // Add covered call premiums
  coveredCalls.forEach(cc => {
    const data = assignedIdToData[cc.assigned_position_id];
    if (data) {
      initSymbol(data.symbol);
      const premium = Number(cc.contracts || 1) * Number(cc.premium_per_contract || 0) * 100;
      symbolStats[data.symbol].premium += premium;
      symbolStats[data.symbol].tradeCount += 1;
      if (data.user_id) symbolClients[data.symbol].add(data.user_id);
    }
  });

  // Update client counts from sets
  Object.keys(symbolStats).forEach(symbol => {
    symbolStats[symbol].clientCount = symbolClients[symbol]?.size || 0;
  });

  // Sort by premium and take top 5
  const topSymbols = Object.entries(symbolStats)
    .sort(([, a], [, b]) => b.premium - a.premium)
    .slice(0, 5);

  const maxPremium = topSymbols.length > 0 ? topSymbols[0][1].premium : 1;

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
          <TooltipProvider>
            <div className="space-y-3">
              {topSymbols.map(([symbol, stats]) => (
                <Tooltip key={symbol}>
                  <TooltipTrigger asChild>
                    <div className="space-y-1 cursor-pointer">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{symbol}</span>
                        <span className="text-muted-foreground">
                          ${stats.premium.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${(stats.premium / maxPremium) * 100}%` }}
                        />
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs space-y-1">
                      <p><span className="font-medium">{stats.clientCount}</span> client{stats.clientCount !== 1 ? 's' : ''}</p>
                      <p><span className="font-medium">{stats.tradeCount}</span> trade{stats.tradeCount !== 1 ? 's' : ''}</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}