import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User, DollarSign, TrendingUp, Activity, Shield, GraduationCap, Briefcase } from "lucide-react";
import { useClientMetrics } from "@/hooks/useClientMetrics";
import type { Tables } from "@/integrations/supabase/types";

interface ClientProfileTabProps {
  client: Tables<"clients">;
  profile: Tables<"profiles"> | null;
}

export function ClientProfileTab({ client, profile }: ClientProfileTabProps) {
  // Use centralized metrics hook for accurate calculations
  const metrics = useClientMetrics(client.user_id);

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
            {metrics.hasRealPortfolioData ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-background/50 border border-border/30">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium text-muted-foreground">Portfolio Value</p>
                    </div>
                    <p className="text-xl font-bold">{formatCurrency(metrics.realPortfolioValue)}</p>
                  </div>

                  <div className="p-4 rounded-lg bg-background/50 border border-border/30">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium text-muted-foreground">Total Premium</p>
                    </div>
                    <p className="text-xl font-bold text-success">{formatCurrency(metrics.realTotalPremium)}</p>
                  </div>

                  <div className="p-4 rounded-lg bg-background/50 border border-border/30">
                    <div className="flex items-center gap-2 mb-1">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium text-muted-foreground">Open CSPs</p>
                    </div>
                    <p className="text-xl font-bold">{metrics.realOpenCspCount}</p>
                  </div>

                  <div className="p-4 rounded-lg bg-background/50 border border-border/30">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium text-muted-foreground">Assigned Capital</p>
                    </div>
                    <p className="text-xl font-bold">{formatCurrency(metrics.realAssignedCostBasis)}</p>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Cash: {formatCurrency(metrics.realCashBalance)} • Other Holdings: {formatCurrency(metrics.realOtherHoldings)}
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
          {metrics.hasSimulatorData ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-background/50 border border-border/30">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium text-muted-foreground">Portfolio Value</p>
                  </div>
                  <p className="text-xl font-bold">{formatCurrency(metrics.simPortfolioValue)}</p>
                </div>

                <div className="p-4 rounded-lg bg-background/50 border border-border/30">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium text-muted-foreground">Total Premium</p>
                  </div>
                  <p className="text-xl font-bold text-success">{formatCurrency(metrics.simTotalPremium)}</p>
                  <p className="text-xs text-muted-foreground mt-1">YTD: {formatCurrency(metrics.simYtdPremium)}</p>
                </div>

                <div className="p-4 rounded-lg bg-background/50 border border-border/30">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium text-muted-foreground">Open CSPs</p>
                  </div>
                  <p className="text-xl font-bold">{metrics.simOpenCspCount}</p>
                </div>

                <div className="p-4 rounded-lg bg-background/50 border border-border/30">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium text-muted-foreground">Risk Level</p>
                  </div>
                  <Badge variant={getRiskBadgeVariant(metrics.calculatedRisk)}>
                    {metrics.calculatedRisk}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 rounded-lg bg-background/30 border border-border/20">
                  <p className="text-xs font-medium text-muted-foreground">Starting Capital</p>
                  <p className="text-sm font-semibold">{formatCurrency(metrics.startingCapital)}</p>
                </div>

                <div className="p-3 rounded-lg bg-background/30 border border-border/20">
                  <p className="text-xs font-medium text-muted-foreground">Cash Secured</p>
                  <p className="text-sm font-semibold">{formatCurrency(metrics.simCashSecured)}</p>
                </div>

                <div className="p-3 rounded-lg bg-background/30 border border-border/20">
                  <p className="text-xs font-medium text-muted-foreground">Assigned Capital</p>
                  <p className="text-sm font-semibold">{formatCurrency(metrics.simActiveAssignedCost)}</p>
                </div>

                <div className="p-3 rounded-lg bg-background/30 border border-border/20">
                  <p className="text-xs font-medium text-muted-foreground">Available Cash</p>
                  <p className="text-sm font-semibold">{formatCurrency(metrics.simAvailableCash)}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <GraduationCap className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Client hasn't started using the Learning Simulator yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
