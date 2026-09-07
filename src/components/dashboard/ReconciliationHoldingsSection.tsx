import { useQuery } from "@tanstack/react-query";
import { AlertCircle, BarChart3, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface ReconciliationHolding {
  holding_type: string;
  symbol: string | null;
  option_type: string | null;
  expiration: string | null;
  strike_price: number | null;
  contracts: number | null;
  shares: number | null;
  market_value: number;
  holding_category: string | null;
  metadata?: Record<string, unknown> | null;
}

interface ReconciliationCoveredCall {
  symbol: string;
  expiration: string;
  strike_price: number;
  contracts: number;
  premium_per_contract: number;
  status: string;
  underlying_source: string;
  underlying_holding_key: string | null;
}

interface ReconciliationSnapshot {
  asOf: string;
  cashBalance: number;
  equityMarketValue: number;
  optionLiability: number;
  realizedPremium: number;
  realizedPremiumGross: number;
  realizedPremiumFees: number;
  realizedCapitalGain: number;
  totalRealizedPnl: number;
  currentUnrealizedPnl: number;
  totalStrategyPnl: number;
  flowAdjustedAccountValueChange: number;
  realizedCapitalGainBreakdown: {
    assignedCallStockProceedsMinusBasis?: number;
    otherSecuritySalesRecognizedGain?: number;
  };
  strategyPnlStatus: string;
  holdings: ReconciliationHolding[];
  coveredCalls: ReconciliationCoveredCall[];
}

function isMissingReconciliationRelation(error: { code?: string } | null) {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

function formatAmount(value: number, options: { signed?: boolean } = {}) {
  const amount = Number(value) || 0;
  const formatted = Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (amount < 0) return `($${formatted})`;
  return `${options.signed ? "+" : ""}$${formatted}`;
}

export function ReconciliationHoldingsSection({ userId }: { userId?: string }) {
  const { data: snapshot, isLoading } = useQuery<ReconciliationSnapshot | null>({
    queryKey: ["reconciliation-holdings", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) return null;

      const { data: rollup, error: rollupError } = await supabase
        .from("current_account_reconciliation_rollup")
        .select("run_id, current_as_of, cash_balance, equity_market_value, option_liability, realized_premium_to_date, total_realized_pnl, current_unrealized_pnl, total_strategy_pnl, statement_premium_gross, statement_premium_fees, summary")
        .eq("user_id", userId)
        .maybeSingle();

      if (rollupError) {
        if (isMissingReconciliationRelation(rollupError)) return null;
        throw rollupError;
      }
      if (!rollup?.run_id) return null;

      const [holdingsResult, callsResult] = await Promise.all([
        supabase
          .from("account_reconciliation_holdings")
          .select("holding_type, symbol, option_type, expiration, strike_price, contracts, shares, market_value, holding_category, metadata")
          .eq("run_id", rollup.run_id),
        supabase
          .from("account_reconciliation_covered_calls")
          .select("symbol, expiration, strike_price, contracts, premium_per_contract, status, underlying_source, underlying_holding_key")
          .eq("run_id", rollup.run_id)
          .neq("underlying_source", "assigned_position"),
      ]);

      if (holdingsResult.error) throw holdingsResult.error;
      if (callsResult.error && !isMissingReconciliationRelation(callsResult.error)) throw callsResult.error;

      return {
        asOf: rollup.current_as_of || "",
        cashBalance: rollup.cash_balance || 0,
        equityMarketValue: rollup.equity_market_value || 0,
        optionLiability: rollup.option_liability || 0,
        realizedPremium: rollup.realized_premium_to_date || 0,
        realizedPremiumGross: Number((rollup.summary as { realizedPremiumGrossToDate?: number } | null)?.realizedPremiumGrossToDate) || Number(rollup.statement_premium_gross) || 0,
        realizedPremiumFees: Number(rollup.statement_premium_fees) || 0,
        realizedCapitalGain: Number((rollup.summary as { realizedCapitalGainToDate?: number } | null)?.realizedCapitalGainToDate) || 0,
        totalRealizedPnl: rollup.total_realized_pnl || 0,
        currentUnrealizedPnl: rollup.current_unrealized_pnl || 0,
        totalStrategyPnl: rollup.total_strategy_pnl || 0,
        flowAdjustedAccountValueChange: Number((rollup.summary as { flowAdjustedAccountValueChange?: number } | null)?.flowAdjustedAccountValueChange) || 0,
        realizedCapitalGainBreakdown: ((rollup.summary as { realizedCapitalGainBreakdown?: ReconciliationSnapshot["realizedCapitalGainBreakdown"] } | null)?.realizedCapitalGainBreakdown) || {},
        strategyPnlStatus: String((rollup.summary as { strategyPnlStatus?: string } | null)?.strategyPnlStatus || "whole_account_control"),
        holdings: (holdingsResult.data || []) as ReconciliationHolding[],
        coveredCalls: (callsResult.data || []) as ReconciliationCoveredCall[],
      };
    },
  });

  if (isLoading || !snapshot) return null;

  const options = snapshot.holdings.filter((holding) => holding.holding_type === "option");
  const calls = options.filter((holding) => holding.option_type === "CALL");
  const puts = options.filter((holding) => holding.option_type === "PUT");
  const equities = snapshot.holdings.filter((holding) => holding.holding_type === "equity");
  const callContracts = calls.reduce((total, holding) => total + (holding.contracts || 0), 0);
  const putContracts = puts.reduce((total, holding) => total + (holding.contracts || 0), 0);
  const optionLiability = options.reduce((total, holding) => total + (holding.market_value || 0), 0);

  const getOptionMetadata = (holding: ReconciliationHolding) => holding.metadata || {};
  const getUnderlying = (holding: ReconciliationHolding) => {
    const metadata = getOptionMetadata(holding);
    const holdingKey = metadata.underlyingHoldingKey || metadata.underlying_holding_key;
    if (typeof holdingKey === "string" && holdingKey.length > 0) return holdingKey;
    const source = metadata.underlyingSource || metadata.underlying_source;
    if (typeof source === "string" && source.length > 0) return source.replaceAll("_", " ");
    return holding.holding_category || "statement holding";
  };
  const getOptionStatus = (holding: ReconciliationHolding) => {
    const status = getOptionMetadata(holding).status;
    return typeof status === "string" && status.length > 0 ? status : `open_as_of_${snapshot.asOf}`;
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart3 className="h-5 w-5" />
          Reconciled Holdings Snapshot
        </CardTitle>
        <CardDescription>
          Statement-backed holdings and non-assignment covered calls as of {snapshot.asOf}. This snapshot is separate from the assignment-only strategy ledger.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-4">
          <div className="rounded border bg-background/70 p-2 text-xs">
            <div className="text-muted-foreground">Cash</div>
            <div className="font-semibold">${snapshot.cashBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="rounded border bg-background/70 p-2 text-xs">
            <div className="text-muted-foreground">Equities / ETPs</div>
            <div className="font-semibold">{equities.length} · ${snapshot.equityMarketValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="rounded border bg-background/70 p-2 text-xs">
            <div className="text-muted-foreground">Calls</div>
            <div className="font-semibold">{calls.length} lots · {callContracts} contracts</div>
          </div>
          <div className="rounded border bg-background/70 p-2 text-xs">
            <div className="text-muted-foreground">Puts</div>
            <div className="font-semibold">{puts.length} lots · {putContracts} contracts</div>
          </div>
        </div>

        <div className="rounded border bg-background/70 p-3">
          <div className="mb-2 text-sm font-medium">Statement-backed P/L controls</div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded border bg-background/60 p-2 text-xs">
              <div className="text-muted-foreground">Realized premium (net)</div>
              <div className="font-semibold">{formatAmount(snapshot.realizedPremium, { signed: true })}</div>
              <div className="text-muted-foreground">Gross {formatAmount(snapshot.realizedPremiumGross)} · fees {formatAmount(snapshot.realizedPremiumFees)}</div>
            </div>
            <div className="rounded border bg-background/60 p-2 text-xs">
              <div className="text-muted-foreground">Realized equity P/L · stock-only</div>
              <div className={`font-semibold ${snapshot.realizedCapitalGain < 0 ? "text-destructive" : "text-success"}`}>{formatAmount(snapshot.realizedCapitalGain, { signed: true })}</div>
              <div className="text-muted-foreground">Assigned {formatAmount(snapshot.realizedCapitalGainBreakdown.assignedCallStockProceedsMinusBasis || 0)} · other sales {formatAmount(snapshot.realizedCapitalGainBreakdown.otherSecuritySalesRecognizedGain || 0)}</div>
            </div>
            <div className="rounded border bg-background/60 p-2 text-xs">
              <div className="text-muted-foreground">Total realized P/L</div>
              <div className={`font-semibold ${snapshot.totalRealizedPnl < 0 ? "text-destructive" : "text-success"}`}>{formatAmount(snapshot.totalRealizedPnl, { signed: true })}</div>
              <div className="text-muted-foreground">Net premium + stock-only equity sales</div>
            </div>
            <div className="rounded border bg-background/60 p-2 text-xs">
              <div className="text-muted-foreground">Derived trading P/L</div>
              <div className={`font-semibold ${snapshot.totalStrategyPnl < 0 ? "text-destructive" : "text-success"}`}>{formatAmount(snapshot.totalStrategyPnl, { signed: true })}</div>
              <div className="text-muted-foreground">Trading control; current unrealized {formatAmount(snapshot.currentUnrealizedPnl)}</div>
            </div>
          </div>
          <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Derived trading control through {snapshot.asOf}: {formatAmount(snapshot.totalStrategyPnl, { signed: true })}. Separate flow-adjusted account-value control: {formatAmount(snapshot.flowAdjustedAccountValueChange, { signed: true })}. Wheel-only attribution remains pending because the statement includes non-wheel trades, dividends, fees, transfers, and reinvestments.</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline"><CheckCircle2 className="mr-1 h-3 w-3" />{calls.length} call lots / {callContracts} contracts</Badge>
          <Badge variant="outline"><CheckCircle2 className="mr-1 h-3 w-3" />{puts.length} put lots / {putContracts} contracts</Badge>
          <Badge variant="secondary">Options liability ${Math.abs(optionLiability || snapshot.optionLiability).toLocaleString("en-US", { minimumFractionDigits: 2 })}</Badge>
        </div>

        <div>
          <div className="mb-2 text-sm font-medium">Open option obligations · {options.length} lots / {callContracts + putContracts} contracts</div>
          <div className="overflow-x-auto rounded border bg-background/70">
            <table className="w-full text-xs">
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  <th className="p-2">Option</th>
                  <th className="p-2">Expiry / strike</th>
                  <th className="p-2">Contracts</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Underlying</th>
                  <th className="p-2 text-right">Liability</th>
                </tr>
              </thead>
              <tbody>
                {options.map((holding) => (
                  <tr key={`${holding.symbol}:${holding.option_type}:${holding.expiration}:${holding.strike_price}`} className="border-b last:border-0">
                    <td className="p-2 font-medium">{holding.symbol} {holding.option_type}</td>
                    <td className="p-2">{holding.expiration || "—"} · ${Number(holding.strike_price || 0).toFixed(2)}</td>
                    <td className="p-2">{holding.contracts || 0}</td>
                    <td className="p-2">{getOptionStatus(holding)}</td>
                    <td className="p-2">{getUnderlying(holding)}</td>
                    <td className="p-2 text-right">${Math.abs(holding.market_value || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            {snapshot.coveredCalls.length} non-assignment call rows are separately source-linked; assignment-backed calls remain in the core wheel ledger.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
