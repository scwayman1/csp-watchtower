import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle, FileSearch } from "lucide-react";

interface ReconciliationReport {
  extractedPositions: Array<{
    symbol: string;
    contracts: number;
    premiumPerContract: number;
    totalPremium: number;
    dateOpened: string;
    expiration: string;
  }>;
  databaseTotal: number;
  statementTotal: number;
  discrepancy: number;
  missingPositions: any[];
  incorrectPositions: any[];
  actionItems: string[];
  summary: string;
}

export function StatementReconciliation() {
  const [statementText, setStatementText] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ReconciliationReport | null>(null);

  const handleReconcile = async () => {
    if (!statementText.trim()) {
      toast({
        title: "No statement provided",
        description: "Please paste your broker statement text.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('reconcile-statement', {
        body: { statementText },
      });

      if (error) throw error;

      setReport(data.reconciliation);
      
      const discrepancy = Math.abs(data.reconciliation.discrepancy);
      
      toast({
        title: discrepancy < 1 ? "Perfect Match!" : "Discrepancies Found",
        description: discrepancy < 1 
          ? "Your database matches your broker statement exactly."
          : `Found $${discrepancy.toFixed(2)} difference. Review the report below.`,
        variant: discrepancy < 1 ? "default" : "destructive",
      });
    } catch (error: any) {
      console.error('Reconciliation error:', error);
      toast({
        title: "Reconciliation failed",
        description: error.message || "Failed to reconcile statement",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSearch className="h-5 w-5" />
          Statement Reconciliation
        </CardTitle>
        <CardDescription>
          Paste your broker statement to validate all premiums and positions match your database exactly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Textarea
            placeholder="Paste your broker statement here (include all CSP settlements from a specific date)..."
            value={statementText}
            onChange={(e) => setStatementText(e.target.value)}
            rows={8}
            className="font-mono text-xs resize-none"
          />
        </div>

        <Button 
          onClick={handleReconcile} 
          disabled={loading || !statementText.trim()}
          className="w-full"
        >
          <FileSearch className="mr-2 h-4 w-4" />
          {loading ? "Reconciling..." : "Validate Statement"}
        </Button>

        {report && (
          <div className="space-y-4 mt-6">
            <Alert variant={Math.abs(report.discrepancy) < 1 ? "default" : "destructive"}>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Summary:</strong> {report.summary}
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Statement Total</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-success">
                    ${report.statementTotal.toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {report.extractedPositions.length} positions
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Database Total</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${report.databaseTotal.toFixed(2)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Discrepancy</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${Math.abs(report.discrepancy) < 1 ? 'text-success' : 'text-destructive'}`}>
                    ${Math.abs(report.discrepancy).toFixed(2)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {report.actionItems.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Action Items
                </h4>
                <ul className="space-y-2">
                  {report.actionItems.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-0.5">{idx + 1}</Badge>
                      <span className="text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {report.missingPositions.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Missing from Database ({report.missingPositions.length})
                </h4>
                <div className="space-y-2">
                  {report.missingPositions.map((pos: any, idx: number) => (
                    <div key={idx} className="text-sm p-2 bg-destructive/10 rounded border border-destructive/20">
                      <strong>{pos.symbol}</strong> - {pos.contracts} contract(s) @ ${pos.premiumPerContract} = ${pos.totalPremium}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {report.incorrectPositions.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 text-warning flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Incorrect in Database ({report.incorrectPositions.length})
                </h4>
                <div className="space-y-2">
                  {report.incorrectPositions.map((pos: any, idx: number) => (
                    <div key={idx} className="text-sm p-2 bg-warning/10 rounded border border-warning/20">
                      {pos.description || JSON.stringify(pos)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Math.abs(report.discrepancy) < 1 && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Perfect match! Your database is 100% accurate with your broker statement.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}