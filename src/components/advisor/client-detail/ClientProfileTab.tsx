import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User, DollarSign, TrendingUp, Activity, Shield, GraduationCap, Briefcase } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfYear } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

interface ClientProfileTabProps {
  client: Tables<"clients">;
  profile: Tables<"profiles"> | null;
}

export function ClientProfileTab({ client, profile }: ClientProfileTabProps) {
  const yearStart = startOfYear(new Date()).toISOString();

  // ========== REAL PORTFOLIO DATA ==========
  const { data: realPositions } = useQuery({
    queryKey: ["client-real-positions", client.user_id],
    queryFn: async () => {
      if (!client.user_id) return [];
      const { data, error } = await supabase
        .from("positions")
        .select("*")
        .eq("user_id", client.user_id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!client.user_id,
  });

  const { data: realAssignedPositions } = useQuery({
    queryKey: ["client-real-assigned", client.user_id],
    queryFn: async () => {
      if (!client.user_id) return [];
      const { data, error } = await supabase
        .from("assigned_positions")
        .select("*")
        .eq("user_id", client.user_id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!client.user_id,
  });

  const { data: realCoveredCalls } = useQuery({
    queryKey: ["client-real-calls", client.user_id],
    queryFn: async () => {
      if (!client.user_id) return [];
      const assignedIds = realAssignedPositions?.map(p => p.id) || [];
      if (assignedIds.length === 0) return [];
      const { data, error } = await supabase
        .from("covered_calls")
        .select("*")
        .in("assigned_position_id", assignedIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!client.user_id && (realAssignedPositions?.length ?? 0) > 0,
  });

  const { data: userSettings } = useQuery({
    queryKey: ["client-user-settings", client.user_id],
    queryFn: async () => {
      if (!client.user_id) return null;
      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", client.user_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!client.user_id,
  });

  // ========== LEARNING SIMULATOR DATA ==========
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

  // ========== REAL PORTFOLIO CALCULATIONS ==========
  const realPutPremium = (realPositions || []).reduce((sum, pos) => {
    return sum + parseFloat(String(pos.premium_per_contract)) * parseFloat(String(pos.contracts)) * 100;
  }, 0);

  const realAssignedPutPremium = (realAssignedPositions || []).reduce((sum, pos) => {
    return sum + parseFloat(String(pos.original_put_premium));
  }, 0);

  const realCallPremium = (realCoveredCalls || []).reduce((sum, call) => {
    return sum + parseFloat(String(call.premium_per_contract)) * parseFloat(String(call.contracts)) * 100;
  }, 0);

  const realTotalPremium = realPutPremium + realAssignedPutPremium + realCallPremium;

  const realOpenCspCount = (realPositions || []).filter(p => p.is_active).length;

  const realAssignedCostBasis = (realAssignedPositions || [])
    .filter(p => p.is_active)
    .reduce((sum, pos) => sum + parseFloat(String(pos.cost_basis)), 0);

  const realCashBalance = userSettings?.cash_balance || 0;
  const realOtherHoldings = userSettings?.other_holdings_value || 0;
  const realPortfolioValue = realCashBalance + realOtherHoldings + realTotalPremium;

  // ========== LEARNING SIMULATOR CALCULATIONS ==========
  const startingCapital = simulatorSettings?.starting_capital || 100000;

  const simPutPremium = (learningPositions || []).reduce((sum, pos) => {
    return sum + parseFloat(String(pos.premium_per_contract)) * parseFloat(String(pos.contracts)) * 100;
  }, 0);

  const simYtdPutPremium = (learningPositions || []).reduce((sum, pos) => {
    if (pos.opened_at >= yearStart) {
      return sum + parseFloat(String(pos.premium_per_contract)) * parseFloat(String(pos.contracts)) * 100;
    }
    return sum;
  }, 0);

  const simCallPremium = (learningCoveredCalls || []).reduce((sum, call) => {
    return sum + parseFloat(String(call.premium_per_contract)) * parseFloat(String(call.contracts)) * 100;
  }, 0);

  const simYtdCallPremium = (learningCoveredCalls || []).reduce((sum, call) => {
    if (call.opened_at >= yearStart) {
      return sum + parseFloat(String(call.premium_per_contract)) * parseFloat(String(call.contracts)) * 100;
    }
    return sum;
  }, 0);

  const simTotalPremium = simPutPremium + simCallPremium;
  const simYtdPremium = simYtdPutPremium + simYtdCallPremium;

  const simOpenCspCount = (learningPositions || []).filter(p => p.is_active).length;

  const simCashSecured = (learningPositions || [])
    .filter(p => p.is_active)
    .reduce((sum, pos) => {
      return sum + parseFloat(String(pos.strike_price)) * parseFloat(String(pos.contracts)) * 100;
    }, 0);

  const simActiveAssignedCost = (learningAssignedPositions || [])
    .filter(p => p.is_active)
    .reduce((sum, pos) => sum + parseFloat(String(pos.cost_basis)), 0);

  const simAllTimeAssignedCost = (learningAssignedPositions || [])
    .reduce((sum, pos) => sum + parseFloat(String(pos.cost_basis)), 0);

  const simSaleProceeds = (learningAssignedPositions || [])
    .filter(p => !p.is_active && p.sold_price)
    .reduce((sum, pos) => {
      return sum + parseFloat(String(pos.sold_price)) * parseFloat(String(pos.shares));
    }, 0);

  const simAvailableCash = startingCapital + simTotalPremium + simSaleProceeds - simCashSecured - simAllTimeAssignedCost;
  const simPortfolioValue = startingCapital + simTotalPremium + simSaleProceeds - simActiveAssignedCost;

  // Risk assessment
  const calculateRisk = () => {
    if (!learningPositions || learningPositions.length === 0) return "Not Set";
    const activePositions = learningPositions.filter(p => p.is_active);
    if (activePositions.length === 0) return "LOW";

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

  const hasRealPortfolioData = (realPositions?.length || 0) > 0 || (realAssignedPositions?.length || 0) > 0;
  const hasSimulatorData = (learningPositions?.length || 0) > 0 || (learningAssignedPositions?.length || 0) > 0;

  return (
    <div className="space-y-6">
      {/* Top row: Profile + Real Portfolio */}
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

        {/* Real Portfolio Summary */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Real Portfolio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasRealPortfolioData ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-background/50 border border-border/30">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium text-muted-foreground">Portfolio Value</p>
                    </div>
                    <p className="text-xl font-bold">{formatCurrency(realPortfolioValue)}</p>
                  </div>

                  <div className="p-4 rounded-lg bg-background/50 border border-border/30">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium text-muted-foreground">Total Premium</p>
                    </div>
                    <p className="text-xl font-bold text-success">{formatCurrency(realTotalPremium)}</p>
                  </div>

                  <div className="p-4 rounded-lg bg-background/50 border border-border/30">
                    <div className="flex items-center gap-2 mb-1">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium text-muted-foreground">Open CSPs</p>
                    </div>
                    <p className="text-xl font-bold">{realOpenCspCount}</p>
                  </div>

                  <div className="p-4 rounded-lg bg-background/50 border border-border/30">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium text-muted-foreground">Assigned Capital</p>
                    </div>
                    <p className="text-xl font-bold">{formatCurrency(realAssignedCostBasis)}</p>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Cash: {formatCurrency(realCashBalance)} • Other Holdings: {formatCurrency(realOtherHoldings)}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No real portfolio data yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Learning Simulator Summary */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Learning Simulator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasSimulatorData ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-background/50 border border-border/30">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium text-muted-foreground">Portfolio Value</p>
                  </div>
                  <p className="text-xl font-bold">{formatCurrency(simPortfolioValue)}</p>
                </div>

                <div className="p-4 rounded-lg bg-background/50 border border-border/30">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium text-muted-foreground">Total Premium</p>
                  </div>
                  <p className="text-xl font-bold text-green-500">{formatCurrency(simTotalPremium)}</p>
                  <p className="text-xs text-muted-foreground mt-1">YTD: {formatCurrency(simYtdPremium)}</p>
                </div>

                <div className="p-4 rounded-lg bg-background/50 border border-border/30">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium text-muted-foreground">Open CSPs</p>
                  </div>
                  <p className="text-xl font-bold">{simOpenCspCount}</p>
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

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-background/50 border border-border/30">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Available Cash</p>
                  <p className="text-lg font-semibold">{formatCurrency(simAvailableCash)}</p>
                </div>
                <div className="p-4 rounded-lg bg-background/50 border border-border/30">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Cash Secured</p>
                  <p className="text-lg font-semibold">{formatCurrency(simCashSecured)}</p>
                </div>
                <div className="p-4 rounded-lg bg-background/50 border border-border/30">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Assigned Capital</p>
                  <p className="text-lg font-semibold">{formatCurrency(simActiveAssignedCost)}</p>
                </div>
                <div className="p-4 rounded-lg bg-background/50 border border-border/30">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Sale Proceeds</p>
                  <p className="text-lg font-semibold">{formatCurrency(simSaleProceeds)}</p>
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                Starting Capital: {formatCurrency(startingCapital)} • 
                Put Premium: {formatCurrency(simPutPremium)} • 
                Call Premium: {formatCurrency(simCallPremium)}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <GraduationCap className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No simulator activity yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Advisor Notes */}
      {client.notes && (
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Advisor Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{client.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
