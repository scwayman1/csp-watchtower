import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { format, parseISO, isBefore, startOfDay } from "date-fns";
import { History, TrendingUp, Calendar, DollarSign, BarChart3 } from "lucide-react";

interface CoveredCallHistoryProps {
  userId?: string;
}

interface CoveredCallWithSymbol {
  id: string;
  symbol: string;
  strike_price: number;
  expiration: string;
  premium_per_contract: number;
  contracts: number;
  opened_at: string;
  closed_at: string | null;
  is_active: boolean;
}

export function CoveredCallHistory({ userId }: CoveredCallHistoryProps) {
  const { data: pastCalls = [], isLoading } = useQuery({
    queryKey: ['covered-call-history', userId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const effectiveUserId = userId || user?.id;
      if (!effectiveUserId) return [];

      // Get all covered calls with their assigned position info
      const { data: assignedPositions } = await supabase
        .from('assigned_positions')
        .select('id, symbol')
        .eq('user_id', effectiveUserId);

      if (!assignedPositions?.length) return [];

      const positionIds = assignedPositions.map(p => p.id);
      const symbolMap = Object.fromEntries(assignedPositions.map(p => [p.id, p.symbol]));

      const { data: calls } = await supabase
        .from('covered_calls')
        .select('*')
        .in('assigned_position_id', positionIds)
        .order('expiration', { ascending: false })
        .order('opened_at', { ascending: false });

      if (!calls) return [];

      const today = startOfDay(new Date());
      
      // Filter to only past/expired calls
      return calls
        .filter(call => {
          const expDate = parseISO(call.expiration);
          return isBefore(expDate, today) || !call.is_active;
        })
        .map(call => ({
          ...call,
          symbol: symbolMap[call.assigned_position_id] || 'Unknown'
        })) as CoveredCallWithSymbol[];
    },
    enabled: true,
  });

  // Group by month
  const groupedByMonth = useMemo(() => {
    const groups = new Map<string, { calls: CoveredCallWithSymbol[]; totalPremium: number }>();
    
    pastCalls.forEach(call => {
      const monthKey = format(parseISO(call.expiration), 'MMM yyyy');
      const premium = call.premium_per_contract * 100 * call.contracts;
      
      if (!groups.has(monthKey)) {
        groups.set(monthKey, { calls: [], totalPremium: 0 });
      }
      const group = groups.get(monthKey)!;
      group.calls.push(call);
      group.totalPremium += premium;
    });

    return Array.from(groups.entries()).sort((a, b) => {
      const dateA = parseISO(a[1].calls[0].expiration);
      const dateB = parseISO(b[1].calls[0].expiration);
      return dateB.getTime() - dateA.getTime();
    });
  }, [pastCalls]);

  const totalHistoricalPremium = useMemo(() => 
    pastCalls.reduce((sum, call) => sum + (call.premium_per_contract * 100 * call.contracts), 0),
    [pastCalls]
  );

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  if (isLoading) {
    return (
      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Covered Call History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse h-24 bg-muted rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (pastCalls.length === 0) {
    return (
      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Covered Call History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No past covered calls yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl overflow-hidden">
      {/* Header with gradient */}
      <CardHeader className="pb-3 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border/50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <History className="h-4 w-4 text-primary" />
            </div>
            Covered Call History
          </CardTitle>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/20">
            <TrendingUp className="h-3.5 w-3.5 text-success" />
            <span className="text-sm font-bold text-success">
              {formatCurrency(totalHistoricalPremium)}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-4 pb-2">
            {groupedByMonth.map(([month, { calls, totalPremium }]) => {
              // Get unique symbols for this month
              const uniqueSymbols = [...new Set(calls.map(c => c.symbol))];
              const totalContracts = calls.reduce((sum, c) => sum + c.contracts, 0);
              
              return (
                <div 
                  key={month}
                  className="min-w-[200px] flex-shrink-0 relative group"
                >
                  {/* Vintage Card Container */}
                  <div className="relative rounded-xl overflow-hidden border border-border/60 bg-gradient-to-b from-card to-muted/30 shadow-sm hover:shadow-md transition-shadow duration-200">
                    {/* Decorative blur circles */}
                    <div className="absolute -top-6 -right-6 w-16 h-16 bg-success/10 rounded-full blur-xl opacity-60" />
                    <div className="absolute -bottom-4 -left-4 w-12 h-12 bg-primary/10 rounded-full blur-lg opacity-40" />
                    
                    {/* Header with month */}
                    <div className="relative px-4 py-3 bg-gradient-to-r from-muted/80 to-muted/40 border-b border-border/40">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-semibold text-sm">{month}</span>
                        </div>
                        <Badge 
                          variant="secondary" 
                          className="text-[10px] px-1.5 py-0 h-5 bg-muted-foreground/10"
                        >
                          {calls.length} call{calls.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    </div>
                    
                    {/* Premium Display */}
                    <div className="relative px-4 py-3 border-b border-border/30">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-success" />
                        <span className="text-xl font-bold text-success">
                          {formatCurrency(totalPremium)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <BarChart3 className="h-3 w-3" />
                        <span>{totalContracts} contract{totalContracts !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    
                    {/* Symbol Details */}
                    <div className="relative px-4 py-3 space-y-2">
                      {calls.slice(0, 3).map(call => (
                        <div 
                          key={call.id} 
                          className="flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{call.symbol}</span>
                            <span className="text-muted-foreground">×{call.contracts}</span>
                          </div>
                          <span className="font-mono text-muted-foreground">${call.strike_price}</span>
                        </div>
                      ))}
                      {calls.length > 3 && (
                        <div className="text-[10px] text-muted-foreground pt-1 border-t border-dashed border-border/40">
                          +{calls.length - 3} more from {uniqueSymbols.length > 1 ? `${uniqueSymbols.length} symbols` : uniqueSymbols[0]}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}