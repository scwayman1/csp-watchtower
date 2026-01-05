import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Brain, 
  Loader2, 
  RefreshCw, 
  AlertTriangle, 
  TrendingUp, 
  Clock, 
  Target,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { differenceInDays } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

interface ClientInsight {
  client: Tables<"clients">;
  positionCount: number;
  avgDte: number;
  weeklyPercentage: number;
  assignmentRate: number;
  totalPremium: number;
  daysActive: number;
  riskLevel: "low" | "medium" | "high";
}

export function ClientLearningInsightsWidget() {
  const navigate = useNavigate();
  const [insights, setInsights] = useState<ClientInsight[]>([]);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  // Fetch all clients with learning activity
  const { data: clientsWithLearning, isLoading } = useQuery({
    queryKey: ["advisor-clients-learning-summary"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get all clients for this advisor
      const { data: clients, error: clientsError } = await supabase
        .from("clients")
        .select("*")
        .eq("advisor_id", user.id);

      if (clientsError) throw clientsError;
      if (!clients || clients.length === 0) return [];

      // Get learning data for clients with user_ids
      const clientsWithUserIds = clients.filter(c => c.user_id);
      if (clientsWithUserIds.length === 0) return [];

      const userIds = clientsWithUserIds.map(c => c.user_id!);

      // Fetch learning positions for all clients
      const { data: allPositions } = await supabase
        .from("learning_positions")
        .select("*")
        .in("user_id", userIds);

      const { data: allAssigned } = await supabase
        .from("learning_assigned_positions")
        .select("*")
        .in("user_id", userIds);

      // Build insights per client
      const clientInsights: ClientInsight[] = [];

      for (const client of clientsWithUserIds) {
        const positions = allPositions?.filter(p => p.user_id === client.user_id) || [];
        const assigned = allAssigned?.filter(a => a.user_id === client.user_id) || [];

        if (positions.length === 0) continue;

        // Calculate metrics
        const positionDetails = positions.map(p => {
          const daysToExpiration = Math.ceil(
            (new Date(p.expiration).getTime() - new Date(p.opened_at).getTime()) / (1000 * 60 * 60 * 24)
          );
          return { dte: daysToExpiration };
        });

        const avgDte = positionDetails.reduce((sum, p) => sum + p.dte, 0) / positionDetails.length;
        const weeklyCount = positionDetails.filter(p => p.dte <= 7).length;
        const weeklyPercentage = (weeklyCount / positions.length) * 100;
        const assignmentRate = (assigned.length / positions.length) * 100;
        const totalPremium = positions.reduce((sum, p) => sum + (p.premium_per_contract * p.contracts * 100), 0);

        // Calculate days active
        const firstPosition = positions.reduce((earliest, p) => {
          const pDate = new Date(p.created_at);
          return pDate < earliest ? pDate : earliest;
        }, new Date());
        const daysActive = differenceInDays(new Date(), firstPosition);

        // Determine risk level
        let riskLevel: "low" | "medium" | "high" = "low";
        if (weeklyPercentage > 50 || assignmentRate > 40) {
          riskLevel = "high";
        } else if (weeklyPercentage > 25 || assignmentRate > 20) {
          riskLevel = "medium";
        }

        clientInsights.push({
          client,
          positionCount: positions.length,
          avgDte,
          weeklyPercentage,
          assignmentRate,
          totalPremium,
          daysActive,
          riskLevel,
        });
      }

      // Sort by risk level (high first) then by activity
      return clientInsights.sort((a, b) => {
        const riskOrder = { high: 0, medium: 1, low: 2 };
        if (riskOrder[a.riskLevel] !== riskOrder[b.riskLevel]) {
          return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
        }
        return b.positionCount - a.positionCount;
      });
    },
  });

  // Generate AI summary for top concerns
  const generateSummary = useMutation({
    mutationFn: async () => {
      if (!clientsWithLearning || clientsWithLearning.length === 0) {
        throw new Error("No client learning data available");
      }

      // For each high-risk client, we could generate individual analyses
      // For now, we'll just set the analyzed flag and show the computed insights
      setInsights(clientsWithLearning);
      setHasAnalyzed(true);
      return clientsWithLearning;
    },
  });

  const activeClients = clientsWithLearning?.length || 0;
  const highRiskClients = clientsWithLearning?.filter(c => c.riskLevel === "high").length || 0;

  if (isLoading) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Client Learning Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!clientsWithLearning || clientsWithLearning.length === 0) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Client Learning Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Brain className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No clients with learning activity yet.</p>
            <p className="text-xs mt-1">Insights will appear as clients use the Learning Center.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Client Learning Insights
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateSummary.mutate()}
            disabled={generateSummary.isPending}
          >
            {generateSummary.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : hasAnalyzed ? (
              <RefreshCw className="h-4 w-4" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {activeClients} client{activeClients !== 1 ? "s" : ""} with simulator activity
          {highRiskClients > 0 && (
            <span className="text-amber-500 ml-2">
              • {highRiskClients} need{highRiskClients === 1 ? "s" : ""} attention
            </span>
          )}
        </p>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[280px]">
          <div className="space-y-3">
            {(hasAnalyzed ? insights : clientsWithLearning).map((item) => (
              <div
                key={item.client.id}
                className="p-3 rounded-lg border border-border/50 hover:bg-accent/30 transition-colors cursor-pointer group"
                onClick={() => navigate(`/advisor/clients/${item.client.id}`)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.client.name}</span>
                    <Badge
                      variant={
                        item.riskLevel === "high"
                          ? "destructive"
                          : item.riskLevel === "medium"
                          ? "secondary"
                          : "outline"
                      }
                      className="text-xs"
                    >
                      {item.riskLevel === "high" && <AlertTriangle className="h-3 w-3 mr-1" />}
                      {item.riskLevel}
                    </Badge>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Trades</span>
                    <p className="font-medium">{item.positionCount}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Avg DTE
                    </span>
                    <p className={`font-medium ${item.avgDte < 14 ? "text-amber-500" : ""}`}>
                      {item.avgDte.toFixed(0)}d
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Target className="h-3 w-3" /> Assigned
                    </span>
                    <p className={`font-medium ${item.assignmentRate > 30 ? "text-red-500" : ""}`}>
                      {item.assignmentRate.toFixed(0)}%
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> Premium
                    </span>
                    <p className="font-medium text-green-500">
                      ${item.totalPremium.toFixed(0)}
                    </p>
                  </div>
                </div>

                {item.riskLevel === "high" && (
                  <div className="mt-2 text-xs text-amber-500/90 bg-amber-500/10 rounded px-2 py-1">
                    {item.weeklyPercentage > 50
                      ? `${item.weeklyPercentage.toFixed(0)}% weekly trades - high risk exposure`
                      : item.assignmentRate > 40
                      ? `${item.assignmentRate.toFixed(0)}% assignment rate - review strike selection`
                      : "Needs coaching attention"}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="mt-3 pt-3 border-t border-border/50">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground hover:text-foreground"
            onClick={() => navigate("/advisor/clients")}
          >
            View All Clients
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
