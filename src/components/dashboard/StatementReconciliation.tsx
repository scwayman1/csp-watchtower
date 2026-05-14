import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle, FileSearch, RefreshCw, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import { verifiedMay2026Payload } from "@/lib/portfolio/verifiedMay2026Payload";

interface ReconciliationReport {
  totalAccountValue?: number;
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

interface StatementReconciliationProps {
  onBaselineUpdate?: () => void;
}

export function StatementReconciliation({ onBaselineUpdate }: StatementReconciliationProps) {
  const { user } = useAuth();
  const { updateSettings } = useSettings(user?.id);
  const [statementText, setStatementText] = useState("");
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [applyingVerified, setApplyingVerified] = useState(false);
  const [verifiedRunId, setVerifiedRunId] = useState<string | null>(null);

  const handleApplyVerifiedPayload = async () => {
    setApplyingVerified(true);
    try {
      const { data, error } = await supabase.rpc("apply_account_reconciliation", {
        p_payload: verifiedMay2026Payload as any,
      });
      if (error) throw error;
      const runId = data as unknown as string;
      setVerifiedRunId(runId);
      toast({
        title: "Reconciliation applied",
        description: `Run id: ${runId}`,
      });
      onBaselineUpdate?.();
    } catch (error: any) {
      toast({
        title: "Apply failed",
        description: error.message || "RPC failed",
        variant: "destructive",
      });
    } finally {
      setApplyingVerified(false);
    }
  };

  const handleUpdateBaseline = async () => {
    if (!report?.totalAccountValue) {
      toast({
        title: "No baseline value",
        description: "Could not extract total account value from statement.",
        variant: "destructive",
      });
      return;
    }

    setUpdating(true);
    try {
      await updateSettings({
        broker_account_value: report.totalAccountValue,
      });

      toast({
        title: "Baseline updated",
        description: `Broker account value set to $${report.totalAccountValue.toLocaleString()}`,
      });

      onBaselineUpdate?.();
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update baseline",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

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
        {/* DEV-ONLY: One-time apply of penny-tied May 2026 reconciliation payload.
            Remove this block + verifiedMay2026Payload.ts after the RPC has been applied. */}
        <div className="rounded-lg border border-warning/40 bg-warning/5 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <ShieldCheck className="h-5 w-5 text-warning mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-semibold">Dev-only: Apply Verified May 2026 Reconciliation</p>
              <p className="text-xs text-muted-foreground">
                Calls <code>apply_account_reconciliation</code> via your authenticated session with the
                pre-verified, penny-tied payload. No Gemini re-parse, no manual table writes.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            {[
              ["Current AUM", "$719,497.09"],
              ["Option liability", "-$4,995.00"],
              ["Cumulative premium", "$68,262.30"],
              ["Realized premium", "$58,337.00"],
              ["Total realized P/L", "$52,830.02"],
              ["Total strategy P/L", "$11,616.80"],
            ].map(([label, value]) => (
              <div key={label} className="rounded border border-border bg-background/50 px-2 py-1.5">
                <div className="text-muted-foreground">{label}</div>
                <div className="font-mono font-semibold">{value}</div>
              </div>
            ))}
          </div>

          {verifiedRunId && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription className="font-mono text-xs break-all">
                Applied. Run id: {verifiedRunId}
              </AlertDescription>
            </Alert>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="w-full border-warning/50"
                disabled={applyingVerified || !!verifiedRunId}
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                {verifiedRunId
                  ? "Already applied"
                  : applyingVerified
                  ? "Applying..."
                  : "Apply Verified May 2026 Reconciliation"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Apply verified reconciliation payload?</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3">
                    <p>
                      This calls <code>apply_account_reconciliation</code> as the signed-in user and
                      writes a new <code>portfolio_history</code> row plus updates{" "}
                      <code>user_settings.broker_account_value</code>.
                    </p>
                    <p>The payload ties to:</p>
                    <ul className="list-disc pl-5 font-mono text-xs space-y-0.5">
                      <li>Current AUM: $719,497.09</li>
                      <li>Option liability: -$4,995.00</li>
                      <li>Cumulative premium: $68,262.30</li>
                      <li>Realized premium: $58,337.00</li>
                      <li>Total realized P/L: $52,830.02</li>
                      <li>Total strategy P/L: $11,616.80</li>
                    </ul>
                    <p className="text-xs text-muted-foreground">
                      The RPC is idempotent on payload hash, so re-clicks return the same run id.
                    </p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleApplyVerifiedPayload}>
                  Confirm &amp; Apply
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

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

            {report.totalAccountValue && (
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
                <div>
                  <p className="text-sm text-muted-foreground">Extracted Broker Account Value</p>
                  <p className="text-2xl font-bold">${report.totalAccountValue.toLocaleString()}</p>
                </div>
                <Button 
                  onClick={handleUpdateBaseline}
                  disabled={updating}
                  variant="default"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${updating ? 'animate-spin' : ''}`} />
                  {updating ? "Updating..." : "Update Baseline"}
                </Button>
              </div>
            )}

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