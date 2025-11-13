import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAIPerformance } from "@/hooks/useAIPerformance";
import { TrendingUp, TrendingDown, Target, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";

export function AIPerformanceTracker() {
  const { data: performance, isLoading } = useAIPerformance();

  if (isLoading) {
    return (
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">AI Performance Tracking</h2>
        <p className="text-muted-foreground">Loading performance data...</p>
      </Card>
    );
  }

  if (!performance || performance.totalRecommendations === 0) {
    return (
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">AI Performance Tracking</h2>
        <p className="text-muted-foreground">No AI recommendations yet. Run an analysis to start tracking performance.</p>
      </Card>
    );
  }

  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;
  const accuracyColor = performance.averageAccuracy > 0.7 ? "text-success" : 
                        performance.averageAccuracy > 0.5 ? "text-warning" : "text-destructive";

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-6">AI Performance Tracking</h2>
      
      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Total Analyzed</p>
          <p className="text-2xl font-bold">{performance.totalRecommendations}</p>
        </div>
        
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Tracked Outcomes</p>
          <p className="text-2xl font-bold">{performance.totalOutcomes}</p>
        </div>
        
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Avg Accuracy</p>
          <p className={`text-2xl font-bold ${accuracyColor}`}>
            {formatPercent(performance.averageAccuracy)}
          </p>
        </div>
        
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Win Rate</p>
          <p className="text-2xl font-bold text-success">
            {performance.totalOutcomes > 0 
              ? formatPercent(performance.profitableOutcomes / performance.totalOutcomes)
              : "0%"}
          </p>
        </div>
      </div>

      {/* Accuracy by Rating */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold mb-3">Accuracy by Quality Rating</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Badge variant="default">Excellent</Badge>
              <span className="text-sm text-muted-foreground">{performance.excellentCount}</span>
            </div>
            <div className="text-lg font-semibold text-success">
              {formatPercent(performance.accuracyByRating.excellent)}
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">Fair</Badge>
              <span className="text-sm text-muted-foreground">{performance.fairCount}</span>
            </div>
            <div className="text-lg font-semibold text-warning">
              {formatPercent(performance.accuracyByRating.fair)}
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Badge variant="destructive">Poor</Badge>
              <span className="text-sm text-muted-foreground">{performance.poorCount}</span>
            </div>
            <div className="text-lg font-semibold text-destructive">
              {formatPercent(performance.accuracyByRating.poor)}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Recommendations with Outcomes */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Recent Recommendations</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {performance.recentRecommendations.map((rec) => (
            <div 
              key={rec.id}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">{rec.symbol}</span>
                  <Badge 
                    variant={
                      rec.quality_rating === "excellent" ? "default" :
                      rec.quality_rating === "fair" ? "secondary" : "destructive"
                    }
                    className="text-xs"
                  >
                    {rec.quality_rating}
                  </Badge>
                  {rec.outcome && (
                    rec.outcome.actual_pnl > 0 ? (
                      <CheckCircle2 className="w-4 h-4 text-success" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive" />
                    )
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {rec.recommended_action}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(rec.created_at), "MMM d, yyyy")}
                </p>
              </div>
              
              <div className="text-right ml-4">
                {rec.outcome ? (
                  <>
                    <div className={`text-sm font-semibold ${rec.outcome.actual_pnl > 0 ? 'text-success' : 'text-destructive'}`}>
                      ${Math.abs(rec.outcome.actual_pnl).toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatPercent(rec.outcome.prediction_accuracy)} accurate
                    </div>
                  </>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    Pending
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}