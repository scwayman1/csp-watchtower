import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DollarSign, TrendingUp, Activity, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useClientMetrics } from "@/hooks/useClientMetrics";

interface ClientDashboardViewProps {
  clientId: string;
}

export function ClientDashboardView({ clientId }: ClientDashboardViewProps) {
  // Fetch client details
  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ["client-details", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Use centralized metrics hook for accurate calculations
  const metrics = useClientMetrics(client?.user_id);

  // Fetch client positions for the table
  const { data: positions, isLoading: positionsLoading } = useQuery({
    queryKey: ["client-positions", clientId],
    queryFn: async () => {
      if (!client?.user_id) return [];

      const { data, error } = await supabase
        .from("positions")
        .select("*")
        .eq("user_id", client.user_id)
        .eq("is_active", true)
        .order("expiration");

      if (error) throw error;
      return data;
    },
    enabled: !!client?.user_id,
  });

  // Fetch assigned positions
  const { data: assignedPositions, isLoading: assignedLoading } = useQuery({
    queryKey: ["client-assigned-positions", clientId],
    queryFn: async () => {
      if (!client?.user_id) return [];

      const { data, error } = await supabase
        .from("assigned_positions")
        .select(`
          *,
          market_data (
            underlying_price
          )
        `)
        .eq("user_id", client.user_id)
        .eq("is_active", true)
        .order("assignment_date", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!client?.user_id,
  });

  if (clientLoading || metrics.isLoading) {
    return <div className="p-6 text-center">Loading client data...</div>;
  }

  if (!client) {
    return <div className="p-6 text-center text-muted-foreground">Client not found</div>;
  }

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  const statCards = [
    {
      title: "Portfolio Value",
      value: formatCurrency(metrics.realPortfolioValue),
      icon: DollarSign,
      description: "Total account value",
    },
    {
      title: "Total Premium",
      value: formatCurrency(metrics.realTotalPremium),
      icon: TrendingUp,
      description: "All-time collected",
      valueClass: "text-success",
    },
    {
      title: "Available Cash",
      value: formatCurrency(metrics.realCashBalance),
      icon: DollarSign,
      description: "Liquid capital",
    },
    {
      title: "Open CSPs",
      value: metrics.realOpenCspCount,
      icon: Activity,
      description: "Active positions",
    },
  ];

  const getMoneyness = (underlyingPrice: number | null, strikePrice: number) => {
    if (!underlyingPrice) return { label: "N/A", variant: "outline" as const };
    const pct = ((underlyingPrice - strikePrice) / strikePrice) * 100;
    if (pct > 0) return { label: "OTM", variant: "success" as const };
    if (pct < 0) return { label: "ITM", variant: "destructive" as const };
    return { label: "ATM", variant: "secondary" as const };
  };

  return (
    <div className="space-y-6">
      {/* Client Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{client.name}</h2>
          <p className="text-sm text-muted-foreground">{client.email}</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline">{client.risk_level || "MEDIUM"}</Badge>
          {client.segment && <Badge variant="secondary">{client.segment}</Badge>}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="bg-card/50 border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${stat.valueClass || ''}`}>
                  {stat.value}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Active Positions */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Active Positions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {positionsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading positions...</div>
          ) : !positions || positions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No active positions</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Strike</TableHead>
                    <TableHead>Expiration</TableHead>
                    <TableHead>Contracts</TableHead>
                    <TableHead>Premium</TableHead>
                    <TableHead>Moneyness</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.map((position) => {
                    const moneyness = getMoneyness(null, position.strike_price);
                    const totalPremium = position.premium_per_contract * position.contracts * 100;
                    return (
                      <TableRow key={position.id}>
                        <TableCell className="font-medium">{position.symbol}</TableCell>
                        <TableCell>${position.strike_price}</TableCell>
                        <TableCell className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {new Date(position.expiration).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{position.contracts}</TableCell>
                        <TableCell className="text-success">
                          {formatCurrency(totalPremium)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={moneyness.variant}>{moneyness.label}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assigned Positions */}
      {assignedPositions && assignedPositions.length > 0 && (
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Assigned Positions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {assignedLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading assigned positions...</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Shares</TableHead>
                      <TableHead>Assignment Price</TableHead>
                      <TableHead>Cost Basis</TableHead>
                      <TableHead>Assignment Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignedPositions.map((position) => {
                      return (
                        <TableRow key={position.id}>
                          <TableCell className="font-medium">{position.symbol}</TableCell>
                          <TableCell>{position.shares}</TableCell>
                          <TableCell>${position.assignment_price}</TableCell>
                          <TableCell>{formatCurrency(position.cost_basis)}</TableCell>
                          <TableCell>
                            {formatDistanceToNow(new Date(position.assignment_date), { addSuffix: true })}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
