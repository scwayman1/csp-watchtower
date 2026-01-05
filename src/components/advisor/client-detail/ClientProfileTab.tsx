import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User, DollarSign, TrendingUp, Activity, Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfYear } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

interface ClientProfileTabProps {
  client: Tables<"clients">;
  profile: Tables<"profiles"> | null;
}

export function ClientProfileTab({ client, profile }: ClientProfileTabProps) {
  // Fetch learning positions for this client
  const { data: learningPositions } = useQuery({
    queryKey: ["client-learning-positions", client.user_id],
    queryFn: async () => {
      if (!client.user_id) return [];
      const { data, error } = await supabase
        .from("learning_positions")
        .select("*")
        .eq("user_id", client.user_id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!client.user_id,
  });

  // Fetch learning assigned positions
  const { data: learningAssignedPositions } = useQuery({
    queryKey: ["client-learning-assigned", client.user_id],
    queryFn: async () => {
      if (!client.user_id) return [];
      const { data, error } = await supabase
        .from("learning_assigned_positions")
        .select("*")
        .eq("user_id", client.user_id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!client.user_id,
  });

  // Fetch learning covered calls
  const { data: learningCoveredCalls } = useQuery({
    queryKey: ["client-learning-calls", client.user_id],
    queryFn: async () => {
      if (!client.user_id) return [];
      const assignedIds = learningAssignedPositions?.map(p => p.id) || [];
      if (assignedIds.length === 0) return [];
      const { data, error } = await supabase
        .from("learning_covered_calls")
        .select("*")
        .in("learning_assigned_position_id", assignedIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!client.user_id && (learningAssignedPositions?.length ?? 0) > 0,
  });

  // Fetch simulator settings
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

  // Calculate metrics from learning data
  const startingCapital = simulatorSettings?.starting_capital || 100000;
  const yearStart = startOfYear(new Date()).toISOString();

  // Total put premium (all time)
  const totalPutPremium = (learningPositions || []).reduce((sum, pos) => {
    return sum + parseFloat(String(pos.premium_per_contract)) * parseFloat(String(pos.contracts)) * 100;
  }, 0);

  // YTD put premium
  const ytdPutPremium = (learningPositions || []).reduce((sum, pos) => {
    if (pos.opened_at >= yearStart) {
      return sum + parseFloat(String(pos.premium_per_contract)) * parseFloat(String(pos.contracts)) * 100;
    }
    return sum;
  }, 0);

  // Covered call premium
  const coveredCallPremium = (learningCoveredCalls || []).reduce((sum, call) => {
    return sum + parseFloat(String(call.premium_per_contract)) * parseFloat(String(call.contracts)) * 100;
  }, 0);

  // YTD covered call premium
  const ytdCoveredCallPremium = (learningCoveredCalls || []).reduce((sum, call) => {
    if (call.opened_at >= yearStart) {
      return sum + parseFloat(String(call.premium_per_contract)) * parseFloat(String(call.contracts)) * 100;
    }
    return sum;
  }, 0);

  // Total premium
  const totalPremium = totalPutPremium + coveredCallPremium;
  const ytdPremium = ytdPutPremium + ytdCoveredCallPremium;

  // Active positions count
  const openCspCount = (learningPositions || []).filter(p => p.is_active).length;

  // Assigned positions metrics
  const activeAssigned = (learningAssignedPositions || []).filter(p => p.is_active);
  const totalAssignedCostBasis = activeAssigned.reduce((sum, pos) => {
    return sum + parseFloat(String(pos.cost_basis));
  }, 0);

  // Cash secured by active puts
  const cashSecured = (learningPositions || [])
    .filter(p => p.is_active)
    .reduce((sum, pos) => {
      return sum + parseFloat(String(pos.strike_price)) * parseFloat(String(pos.contracts)) * 100;
    }, 0);

  // Sale proceeds from closed assigned positions
  const saleProceeds = (learningAssignedPositions || [])
    .filter(p => !p.is_active && p.sold_price)
    .reduce((sum, pos) => {
      return sum + parseFloat(String(pos.sold_price)) * parseFloat(String(pos.shares));
    }, 0);

  // All time assigned cost basis (for cash calculation)
  const allTimeAssignedCost = (learningAssignedPositions || []).reduce((sum, pos) => {
    return sum + parseFloat(String(pos.cost_basis));
  }, 0);

  // Available cash calculation
  const availableCash = startingCapital + totalPremium + saleProceeds - cashSecured - allTimeAssignedCost;

  // Portfolio value (simplified - starting capital + premiums - active positions cost + sale proceeds)
  const portfolioValue = startingCapital + totalPremium + saleProceeds - totalAssignedCostBasis;

  // Risk assessment based on position characteristics
  const calculateRisk = () => {
    if (!learningPositions || learningPositions.length === 0) return "Not Set";
    
    const activePositions = learningPositions.filter(p => p.is_active);
    if (activePositions.length === 0) return "LOW";

    // Check for weekly trades
    const weeklyTrades = activePositions.filter(p => {
      const expDate = new Date(p.expiration);
      const openDate = new Date(p.opened_at);
      const daysDiff = (expDate.getTime() - openDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 7;
    });

    const weeklyRatio = weeklyTrades.length / activePositions.length;
    
    if (weeklyRatio > 0.5) return "HIGH";
    if (weeklyRatio > 0.2) return "MEDIUM";
    return "LOW";
  };

  const calculatedRisk = calculateRisk();

  const formatCurrency = (value: number | null) => {
    if (value === null) return "$0.00";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const getRiskBadgeVariant = (risk: string | null) => {
    switch (risk) {
      case "LOW":
        return "secondary";
      case "MEDIUM":
        return "default";
      case "HIGH":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Profile Info */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Investor Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback>
                <User className="h-8 w-8" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="text-lg font-semibold">{profile?.full_name || client.name}</h3>
              {profile?.bio && (
                <p className="text-sm text-muted-foreground mt-1">{profile.bio}</p>
              )}
            </div>
          </div>

          {profile && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Experience</p>
                  <p className="text-sm capitalize">{profile.investment_experience || "Not set"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Risk Tolerance</p>
                  <p className="text-sm capitalize">{profile.risk_tolerance || "Not set"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Years Trading</p>
                  <p className="text-sm">{profile.years_trading || "Not set"}</p>
                </div>
              </div>

              {profile.investment_goals && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Investment Goals</p>
                  <p className="text-sm">{profile.investment_goals}</p>
                </div>
              )}

              {profile.preferred_strategies && profile.preferred_strategies.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Preferred Strategies</p>
                  <div className="flex flex-wrap gap-2">
                    {profile.preferred_strategies.map((strategy) => (
                      <Badge key={strategy} variant="secondary">
                        {strategy}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {!profile && (
            <p className="text-sm text-muted-foreground">
              Client has not completed their investor profile yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Portfolio Summary - Calculated from Learning Data */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Learning Simulator Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-background/50 border border-border/30">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Portfolio Value</p>
              </div>
              <p className="text-xl font-bold">{formatCurrency(portfolioValue)}</p>
            </div>

            <div className="p-4 rounded-lg bg-background/50 border border-border/30">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Premium YTD</p>
              </div>
              <p className="text-xl font-bold text-green-500">{formatCurrency(ytdPremium)}</p>
            </div>

            <div className="p-4 rounded-lg bg-background/50 border border-border/30">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Open CSPs</p>
              </div>
              <p className="text-xl font-bold">{openCspCount}</p>
            </div>

            <div className="p-4 rounded-lg bg-background/50 border border-border/30">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Risk Level</p>
              </div>
              <Badge variant={getRiskBadgeVariant(calculatedRisk)}>
                {calculatedRisk}
              </Badge>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-background/50 border border-border/30">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">Available Cash</p>
            </div>
            <p className="text-xl font-bold">{formatCurrency(availableCash)}</p>
          </div>

          <div className="text-xs text-muted-foreground">
            Starting Capital: {formatCurrency(startingCapital)} • Total Premium: {formatCurrency(totalPremium)}
          </div>

          {client.notes && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Advisor Notes</p>
              <p className="text-sm bg-muted/30 p-3 rounded-lg">{client.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
