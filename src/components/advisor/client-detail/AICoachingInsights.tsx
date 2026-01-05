import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Brain, Loader2, RefreshCw, AlertCircle, TrendingUp, Target, Clock } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import ReactMarkdown from "react-markdown";

interface AICoachingInsightsProps {
  client: Tables<"clients">;
  positions: Tables<"learning_positions">[] | undefined;
  assignedPositions: Tables<"learning_assigned_positions">[] | undefined;
  startingCapital: number;
  daysActive: number;
}

interface AnalysisResult {
  analysis: string;
  metrics: {
    totalPremium: number;
    assignmentRate: number;
    avgDte: number;
    weeklyPercentage: number;
    symbolCount: number;
  };
}

export function AICoachingInsights({ 
  client, 
  positions, 
  assignedPositions, 
  startingCapital, 
  daysActive 
}: AICoachingInsightsProps) {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  const analyzeActivity = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("analyze-learning-activity", {
        body: {
          clientName: client.name,
          positions: positions || [],
          assignedPositions: assignedPositions || [],
          startingCapital,
          daysActive,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data as AnalysisResult;
    },
    onSuccess: (data) => {
      setAnalysisResult(data);
    },
  });

  const hasActivity = positions && positions.length > 0;

  if (!client.user_id) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            AI Coaching Assessment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Client has not signed up yet. AI analysis will be available once they start using the Learning Center.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!hasActivity) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            AI Coaching Assessment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              No learning activity to analyze yet.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              AI insights will be available once {client.name} starts making simulated trades.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            AI Coaching Assessment
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => analyzeActivity.mutate()}
            disabled={analyzeActivity.isPending}
          >
            {analyzeActivity.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : analysisResult ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Analysis
              </>
            ) : (
              <>
                <Brain className="h-4 w-4 mr-2" />
                Generate Analysis
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {analyzeActivity.isError && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4">
            <p className="text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {analyzeActivity.error instanceof Error ? analyzeActivity.error.message : "Failed to generate analysis"}
            </p>
          </div>
        )}

        {analysisResult ? (
          <div className="space-y-4">
            {/* Quick Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-1 mb-1">
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span className="text-xs text-muted-foreground">Premium</span>
                </div>
                <span className="text-sm font-semibold">
                  ${analysisResult.metrics.totalPremium.toFixed(0)}
                </span>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-1 mb-1">
                  <Target className="h-3 w-3 text-orange-500" />
                  <span className="text-xs text-muted-foreground">Assignment</span>
                </div>
                <span className="text-sm font-semibold">
                  {analysisResult.metrics.assignmentRate.toFixed(1)}%
                </span>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-1 mb-1">
                  <Clock className="h-3 w-3 text-blue-500" />
                  <span className="text-xs text-muted-foreground">Avg DTE</span>
                </div>
                <span className="text-sm font-semibold">
                  {analysisResult.metrics.avgDte.toFixed(0)} days
                </span>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-1 mb-1">
                  <AlertCircle className="h-3 w-3 text-amber-500" />
                  <span className="text-xs text-muted-foreground">Weekly %</span>
                </div>
                <Badge variant={analysisResult.metrics.weeklyPercentage > 50 ? "destructive" : "secondary"} className="text-xs">
                  {analysisResult.metrics.weeklyPercentage.toFixed(0)}%
                </Badge>
              </div>
            </div>

            {/* AI Analysis */}
            <ScrollArea className="h-[400px] pr-4">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => <h2 className="text-lg font-bold mt-4 mb-2">{children}</h2>,
                    h2: ({ children }) => <h3 className="text-base font-semibold mt-4 mb-2 text-primary">{children}</h3>,
                    h3: ({ children }) => <h4 className="text-sm font-medium mt-3 mb-1">{children}</h4>,
                    ul: ({ children }) => <ul className="list-disc pl-4 space-y-1 my-2">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal pl-4 space-y-1 my-2">{children}</ol>,
                    li: ({ children }) => <li className="text-sm">{children}</li>,
                    p: ({ children }) => <p className="text-sm my-2 leading-relaxed">{children}</p>,
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  }}
                >
                  {analysisResult.analysis}
                </ReactMarkdown>
              </div>
            </ScrollArea>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Brain className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground mb-2">
              Get an AI-powered assessment of {client.name}'s learning progress
            </p>
            <p className="text-xs text-muted-foreground mb-4 max-w-md">
              The AI will analyze their trading patterns, risk management, and provide personalized coaching recommendations.
            </p>
            <Button onClick={() => analyzeActivity.mutate()} disabled={analyzeActivity.isPending}>
              {analyzeActivity.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Analysis...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4 mr-2" />
                  Generate Coaching Assessment
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
