import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from "recharts";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";

interface MonthlyData {
  month: string;
  monthLabel: string;
  premium: number;
  cumulative: number;
}

export function MonthlyPremiumTrendChart() {
  // Get advisor's clients
  const { data: clients } = useQuery({
    queryKey: ["advisor-clients-for-trends"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("clients")
        .select("id, user_id")
        .eq("advisor_id", user.id);

      if (error) throw error;
      return data || [];
    },
  });

  const clientUserIds = clients?.map((c) => c.user_id).filter(Boolean) || [];

  // Fetch all positions for these clients
  const { data: positions } = useQuery({
    queryKey: ["advisor-positions-trends", clientUserIds],
    queryFn: async () => {
      if (clientUserIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("positions")
        .select("id, user_id, premium_per_contract, contracts, created_at")
        .in("user_id", clientUserIds);

      if (error) throw error;
      return data || [];
    },
    enabled: clientUserIds.length > 0,
  });

  // Fetch assigned positions
  const { data: assignedPositions } = useQuery({
    queryKey: ["advisor-assigned-trends", clientUserIds],
    queryFn: async () => {
      if (clientUserIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("assigned_positions")
        .select("id, user_id, original_put_premium, created_at")
        .in("user_id", clientUserIds);

      if (error) throw error;
      return data || [];
    },
    enabled: clientUserIds.length > 0,
  });

  // Fetch covered calls
  const { data: coveredCalls } = useQuery({
    queryKey: ["advisor-covered-calls-trends", clientUserIds],
    queryFn: async () => {
      if (clientUserIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("covered_calls")
        .select("id, premium_per_contract, contracts, created_at, assigned_position_id, assigned_positions!inner(user_id)")
        .in("assigned_positions.user_id", clientUserIds);

      if (error) throw error;
      return data || [];
    },
    enabled: clientUserIds.length > 0,
  });

  const chartData = useMemo(() => {
    const now = new Date();
    const months: MonthlyData[] = [];
    
    // Generate last 12 months
    for (let i = 11; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      months.push({
        month: format(monthDate, "yyyy-MM"),
        monthLabel: format(monthDate, "MMM"),
        premium: 0,
        cumulative: 0,
      });
    }

    // Aggregate positions by month
    positions?.forEach((pos) => {
      const monthKey = format(new Date(pos.created_at), "yyyy-MM");
      const monthEntry = months.find((m) => m.month === monthKey);
      if (monthEntry) {
        const premium = Number(pos.premium_per_contract || 0) * Number(pos.contracts || 1);
        monthEntry.premium += premium;
      }
    });

    // Aggregate assigned positions by month (original put premium)
    assignedPositions?.forEach((ap) => {
      const monthKey = format(new Date(ap.created_at), "yyyy-MM");
      const monthEntry = months.find((m) => m.month === monthKey);
      if (monthEntry) {
        // Don't add original_put_premium here as it's already counted when the position was created
        // Only add if this is truly new premium (e.g., from assignment benefits)
      }
    });

    // Aggregate covered calls by month
    coveredCalls?.forEach((cc) => {
      const monthKey = format(new Date(cc.created_at), "yyyy-MM");
      const monthEntry = months.find((m) => m.month === monthKey);
      if (monthEntry) {
        const premium = Number(cc.premium_per_contract || 0) * Number(cc.contracts || 1);
        monthEntry.premium += premium;
      }
    });

    // Calculate cumulative
    let cumulative = 0;
    months.forEach((m) => {
      cumulative += m.premium;
      m.cumulative = cumulative;
    });

    return months;
  }, [positions, assignedPositions, coveredCalls]);

  const formatCurrency = (value: number) => {
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const totalPremium = chartData.reduce((sum, m) => sum + m.premium, 0);
  const avgMonthly = totalPremium / 12;

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-sm font-medium">Monthly Premium Trends</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Last 12 months • Avg: {formatCurrency(avgMonthly)}/mo
          </p>
        </div>
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
              <XAxis 
                dataKey="monthLabel" 
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                className="fill-muted-foreground"
              />
              <YAxis 
                yAxisId="left"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatCurrency}
                className="fill-muted-foreground"
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatCurrency}
                className="fill-muted-foreground"
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
                      <p className="font-medium text-sm mb-2">{label}</p>
                      <div className="space-y-1 text-xs">
                        <p className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-primary" />
                          <span className="text-muted-foreground">Monthly:</span>
                          <span className="font-medium">{formatCurrency(payload[0]?.value as number || 0)}</span>
                        </p>
                        <p className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-success" />
                          <span className="text-muted-foreground">Cumulative:</span>
                          <span className="font-medium">{formatCurrency(payload[1]?.value as number || 0)}</span>
                        </p>
                      </div>
                    </div>
                  );
                }}
              />
              <Bar 
                yAxisId="left"
                dataKey="premium" 
                fill="hsl(var(--primary))" 
                radius={[4, 4, 0, 0]}
                opacity={0.8}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cumulative"
                stroke="hsl(var(--success))"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
