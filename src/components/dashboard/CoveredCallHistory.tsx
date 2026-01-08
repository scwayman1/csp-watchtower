import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { format, parseISO, isBefore, startOfDay } from "date-fns";
import { History, TrendingUp } from "lucide-react";

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
        .order('expiration', { ascending: false });

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
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Covered Call History
          </CardTitle>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-success" />
            <span className="text-lg font-bold text-success">
              {formatCurrency(totalHistoricalPremium)}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-3 pb-2">
            {groupedByMonth.map(([month, { calls, totalPremium }]) => (
              <Card 
                key={month}
                className="min-w-[180px] flex-shrink-0 bg-muted/30 border-muted"
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{month}</span>
                    <Badge variant="secondary" className="text-xs">
                      {calls.length} call{calls.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <div className="text-lg font-bold text-success mb-2">
                    {formatCurrency(totalPremium)}
                  </div>
                  <div className="space-y-1">
                    {calls.slice(0, 3).map(call => (
                      <div key={call.id} className="text-xs text-muted-foreground flex justify-between">
                        <span>{call.symbol}</span>
                        <span>${call.strike_price}</span>
                      </div>
                    ))}
                    {calls.length > 3 && (
                      <div className="text-xs text-muted-foreground">
                        +{calls.length - 3} more
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
