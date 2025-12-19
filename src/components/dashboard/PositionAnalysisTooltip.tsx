import { useState } from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ExternalLink, Loader2, AlertTriangle, TrendingUp, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Position } from "@/components/dashboard/PositionsTable";

interface PositionAnalysis {
  summary: string;
  suggestion: string;
  risk_level: "low" | "medium" | "high";
  news_keywords: string[];
  newsLinks: { title: string; url: string }[];
  symbol: string;
}

interface PositionAnalysisTooltipProps {
  position: Position;
  children: React.ReactNode;
  variant?: "success" | "destructive";
}

export function PositionAnalysisTooltip({ position, children, variant = "success" }: PositionAnalysisTooltipProps) {
  const [analysis, setAnalysis] = useState<PositionAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const fetchAnalysis = async () => {
    if (hasLoaded || isLoading) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('analyze-stock', {
        body: { 
          symbol: position.symbol,
          position: {
            strikePrice: position.strikePrice,
            daysToExp: position.daysToExp,
            totalPremium: position.totalPremium,
            pctAboveStrike: position.pctAboveStrike,
            unrealizedPnL: position.unrealizedPnL,
            statusBand: position.statusBand
          }
        }
      });

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);
      
      setAnalysis(data);
      setHasLoaded(true);
    } catch (err) {
      console.error("Error fetching analysis:", err);
      setError(err instanceof Error ? err.message : "Failed to load analysis");
    } finally {
      setIsLoading(false);
    }
  };

  const getRiskBadge = (riskLevel: string) => {
    switch (riskLevel) {
      case "low":
        return <Badge variant="success" className="text-xs"><Shield className="h-3 w-3 mr-1" />Low Risk</Badge>;
      case "medium":
        return <Badge variant="warning" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" />Medium Risk</Badge>;
      case "high":
        return <Badge variant="destructive" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" />High Risk</Badge>;
      default:
        return null;
    }
  };

  return (
    <HoverCard openDelay={300} onOpenChange={(open) => open && fetchAnalysis()}>
      <HoverCardTrigger asChild>
        <div className="cursor-pointer">{children}</div>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 p-4" side="top" align="center">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className={`h-4 w-4 ${variant === "success" ? "text-success" : "text-destructive"}`} />
              <span className="font-semibold text-sm">AI Analysis</span>
            </div>
            {analysis && getRiskBadge(analysis.risk_level)}
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Analyzing {position.symbol}...</span>
            </div>
          )}

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
              {error}
            </div>
          )}

          {analysis && !isLoading && (
            <>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{analysis.summary}</p>
                
                <div className="bg-muted/50 rounded-md p-2">
                  <div className="flex items-start gap-2">
                    <TrendingUp className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm font-medium">{analysis.suggestion}</p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-2">
                <p className="text-xs text-muted-foreground mb-2">Related News</p>
                <div className="space-y-1">
                  {analysis.newsLinks.slice(0, 3).map((link, idx) => (
                    <a
                      key={idx}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {link.title}
                    </a>
                  ))}
                </div>
              </div>
            </>
          )}

          {!isLoading && !error && !analysis && (
            <p className="text-sm text-muted-foreground text-center py-2">
              Hover to load AI analysis
            </p>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
