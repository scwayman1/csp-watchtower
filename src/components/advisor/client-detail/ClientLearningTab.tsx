import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, Target, Calendar, DollarSign, Activity, CheckCircle2 } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

interface ClientLearningTabProps {
  client: Tables<"clients">;
}

export function ClientLearningTab({ client }: ClientLearningTabProps) {
  const { data: simulatorSettings } = useQuery({
    queryKey: ["client-simulator-settings", client.user_id],
    queryFn: async () => {
      if (!client.user_id) return null;
      
      const { data, error } = await supabase
        .from("simulator_settings")
        .select("*")
        .eq("user_id", client.user_id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!client.user_id,
  });

  const { data: learningPositions } = useQuery({
    queryKey: ["client-learning-positions", client.user_id],
    queryFn: async () => {
      if (!client.user_id) return [];
      
      const { data, error } = await supabase
        .from("learning_positions")
        .select("*")
        .eq("user_id", client.user_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!client.user_id,
  });

  const { data: learningAssigned } = useQuery({
    queryKey: ["client-learning-assigned", client.user_id],
    queryFn: async () => {
      if (!client.user_id) return [];
      
      const { data, error } = await supabase
        .from("learning_assigned_positions")
        .select("*")
        .eq("user_id", client.user_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!client.user_id,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  // Calculate learning metrics
  const totalPositions = learningPositions?.length || 0;
  const activePositions = learningPositions?.filter(p => p.is_active).length || 0;
  const closedPositions = totalPositions - activePositions;
  const totalPremiums = learningPositions?.reduce((sum, p) => sum + (p.premium_per_contract * p.contracts * 100), 0) || 0;
  const assignedCount = learningAssigned?.filter(a => a.is_active).length || 0;
  const closedAssigned = learningAssigned?.filter(a => !a.is_active).length || 0;

  // Calculate days active
  const firstPosition = learningPositions?.length ? 
    learningPositions.reduce((earliest, p) => {
      const pDate = new Date(p.created_at);
      return pDate < earliest ? pDate : earliest;
    }, new Date()) : null;
  const daysActive = firstPosition ? differenceInDays(new Date(), firstPosition) : 0;

  if (!client.user_id) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground">
            Client has not signed up yet. Learning Center data will be available once they create an account.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Learning Progress Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium text-muted-foreground">Total Trades</p>
            </div>
            <p className="text-2xl font-bold">{totalPositions}</p>
            <p className="text-xs text-muted-foreground">{activePositions} active</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-green-500" />
              <p className="text-sm font-medium text-muted-foreground">Total Premium</p>
            </div>
            <p className="text-2xl font-bold text-green-500">{formatCurrency(totalPremiums)}</p>
            <p className="text-xs text-muted-foreground">Simulated</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-4 w-4 text-orange-500" />
              <p className="text-sm font-medium text-muted-foreground">Assignments</p>
            </div>
            <p className="text-2xl font-bold">{assignedCount}</p>
            <p className="text-xs text-muted-foreground">{closedAssigned} closed</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4 text-blue-500" />
              <p className="text-sm font-medium text-muted-foreground">Days Active</p>
            </div>
            <p className="text-2xl font-bold">{daysActive}</p>
            <p className="text-xs text-muted-foreground">Learning journey</p>
          </CardContent>
        </Card>
      </div>

      {/* Starting Capital */}
      {simulatorSettings && (
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Simulator Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              <span className="text-muted-foreground">Starting Capital:</span>{" "}
              <span className="font-semibold">{formatCurrency(simulatorSettings.starting_capital)}</span>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Recent Learning Positions */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Recent Simulated Trades
          </CardTitle>
        </CardHeader>
        <CardContent>
          {learningPositions && learningPositions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Strike</TableHead>
                  <TableHead>Expiration</TableHead>
                  <TableHead>Contracts</TableHead>
                  <TableHead>Premium</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {learningPositions.slice(0, 10).map((position) => (
                  <TableRow key={position.id}>
                    <TableCell className="font-medium">{position.symbol}</TableCell>
                    <TableCell>{formatCurrency(position.strike_price)}</TableCell>
                    <TableCell>{format(parseISO(position.expiration), "MMM d, yyyy")}</TableCell>
                    <TableCell>{position.contracts}</TableCell>
                    <TableCell className="text-green-500">
                      {formatCurrency(position.premium_per_contract * position.contracts * 100)}
                    </TableCell>
                    <TableCell>
                      {position.is_active ? (
                        <Badge variant="default">Active</Badge>
                      ) : (
                        <Badge variant="secondary">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Closed
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No simulated trades yet. Client is still getting started.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Assigned Positions */}
      {learningAssigned && learningAssigned.length > 0 && (
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Simulated Assignments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Shares</TableHead>
                  <TableHead>Cost Basis</TableHead>
                  <TableHead>Assignment Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {learningAssigned.slice(0, 5).map((assigned) => (
                  <TableRow key={assigned.id}>
                    <TableCell className="font-medium">{assigned.symbol}</TableCell>
                    <TableCell>{assigned.shares}</TableCell>
                    <TableCell>{formatCurrency(assigned.cost_basis)}</TableCell>
                    <TableCell>{format(new Date(assigned.assignment_date), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      {assigned.is_active ? (
                        <Badge variant="default">Holding</Badge>
                      ) : (
                        <Badge variant="secondary">Sold</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
