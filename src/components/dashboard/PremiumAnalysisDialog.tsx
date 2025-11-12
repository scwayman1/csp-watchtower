import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, TrendingUp } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Position } from "./PositionsTable";

interface PremiumAnalysisDialogProps {
  position: Position;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AnalysisResult {
  analysis: string;
  metrics: {
    cashSecured: number;
    returnOnCapital: number;
    annualizedROC: number;
    qualityRating: 'excellent' | 'good' | 'fair' | 'poor';
  };
}

export function PremiumAnalysisDialog({ position, open, onOpenChange }: PremiumAnalysisDialogProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const { toast } = useToast();

  const analyzePosition = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-premium', {
        body: { position }
      });

      if (error) throw error;

      setResult(data);
    } catch (error: any) {
      console.error('Error analyzing premium:', error);
      toast({
        title: "Analysis Error",
        description: error.message || "Failed to analyze premium. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && !result) {
      analyzePosition();
    }
    onOpenChange(newOpen);
  };

  const getQualityColor = (rating: string) => {
    switch (rating) {
      case 'excellent': return 'text-success';
      case 'good': return 'text-success';
      case 'fair': return 'text-warning';
      case 'poor': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const getQualityBadge = (rating: string): "success" | "warning" | "destructive" | "default" => {
    switch (rating) {
      case 'excellent': return 'success';
      case 'good': return 'success';
      case 'fair': return 'warning';
      case 'poor': return 'destructive';
      default: return 'default';
    }
  };

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Premium Analysis: {position.symbol}
          </DialogTitle>
          <DialogDescription>
            AI-powered insights on Return on Capital, risk factors, and alternative strategies
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analyzing premium quality and market conditions...</p>
          </div>
        )}

        {result && !loading && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-lg border bg-card p-4">
                <div className="text-xs text-muted-foreground mb-1">Cash Secured</div>
                <div className="text-lg font-semibold">{formatCurrency(result.metrics.cashSecured)}</div>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <div className="text-xs text-muted-foreground mb-1">Return on Capital</div>
                <div className="text-lg font-semibold text-primary">{result.metrics.returnOnCapital.toFixed(2)}%</div>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <div className="text-xs text-muted-foreground mb-1">Annualized ROC</div>
                <div className="text-lg font-semibold text-primary">{result.metrics.annualizedROC.toFixed(2)}%</div>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <div className="text-xs text-muted-foreground mb-1">Quality Rating</div>
                <Badge variant={getQualityBadge(result.metrics.qualityRating)} className="text-sm">
                  {result.metrics.qualityRating.toUpperCase()}
                </Badge>
              </div>
            </div>

            {/* AI Analysis */}
            <div className="rounded-lg border bg-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">AI Insights</h3>
              </div>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {result.analysis}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={analyzePosition} disabled={loading}>
                <Sparkles className="h-4 w-4 mr-2" />
                Reanalyze
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
