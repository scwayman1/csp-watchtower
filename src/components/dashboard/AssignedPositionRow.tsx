import { useState } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { LearningAssignedPosition, LearningCoveredCall } from "@/hooks/useLearningAssignedPositions";
import { SellSharesDialog } from "./SellSharesDialog";

interface AssignedPositionRowProps {
  position: LearningAssignedPosition & {
    currentPrice: number;
    dayChangePct?: number;
    marketValue: number;
    unrealizedPnL: number;
    coveredCallPremiums: number;
  };
  onSellCall: (position: any) => void;
  onSellShares: (position: any, sharesToSell: number) => void;
}

export const AssignedPositionRow = ({ position, onSellCall, onSellShares }: AssignedPositionRowProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [sellDialogOpen, setSellDialogOpen] = useState(false);
  
  const activeCalls = position.covered_calls?.filter(call => call.is_active) || [];
  const sharesUnderCall = activeCalls.reduce((sum, call) => sum + (call.contracts * 100), 0);
  const freeShares = position.shares - sharesUnderCall;

  const handleSellConfirm = (sharesToSell: number) => {
    onSellShares(position, sharesToSell);
  };

  const getTrendIcon = () => {
    if (!position.dayChangePct) return <Minus className="w-3 h-3 text-muted-foreground" />;
    if (position.dayChangePct > 0) return <TrendingUp className="w-3 h-3 text-success" />;
    return <TrendingDown className="w-3 h-3 text-destructive" />;
  };
  
  // Calculate potential gains if called away
  const calculateCallAwayGain = (call: LearningCoveredCall) => {
    const sharesForCall = call.contracts * 100;
    const callPremium = call.premium_per_contract * call.contracts * 100;
    const capitalGain = (call.strike_price - position.assignment_price) * sharesForCall;
    return callPremium + capitalGain;
  };

  // Check expiration status
  const getCallStatus = (call: LearningCoveredCall) => {
    const daysToExp = Math.ceil((new Date(call.expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const isITM = position.currentPrice > call.strike_price;
    
    if (daysToExp <= 0) {
      return { label: "Expired", variant: "destructive" as const, risk: "high" };
    } else if (daysToExp <= 3 && isITM) {
      return { label: `${daysToExp}d - High Risk`, variant: "destructive" as const, risk: "high" };
    } else if (daysToExp <= 7 && isITM) {
      return { label: `${daysToExp}d - At Risk`, variant: "secondary" as const, risk: "medium" };
    } else if (isITM) {
      return { label: `${daysToExp}d - ITM`, variant: "secondary" as const, risk: "low" };
    } else {
      return { label: `${daysToExp}d - Safe`, variant: "outline" as const, risk: "none" };
    }
  };

  const totalPutPremium = position.original_put_premium || 0;
  const totalCallPremiums = position.coveredCallPremiums || 0;
  const totalPremiums = totalPutPremium + totalCallPremiums;
  const netCostBasis = position.cost_basis - totalPremiums;
  const breakEvenPerShare = netCostBasis / position.shares;
  const pctAboveBreakEven = ((position.currentPrice - breakEvenPerShare) / breakEvenPerShare) * 100;
  const isAboveBreakEven = position.currentPrice >= breakEvenPerShare;

  return (
    <>
      <TableRow>
        <TableCell>
          <div className="flex items-center gap-2">
            <span className="font-medium">{position.symbol}</span>
            {activeCalls.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {activeCalls.length} call{activeCalls.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell>
          <div className="flex flex-col gap-1">
            <span className="font-medium">{position.shares.toLocaleString()}</span>
            {sharesUnderCall > 0 && (
              <div className="text-xs text-muted-foreground">
                <span className="text-warning">{sharesUnderCall}</span> under call
                {freeShares > 0 && (
                  <> · <span className="text-success">{freeShares}</span> free</>
                )}
              </div>
            )}
          </div>
        </TableCell>
        <TableCell>
          {position.currentPrice > 0 ? (
            <div className="flex flex-col gap-1">
              <span className="font-medium cursor-pointer hover:text-primary transition-colors">
                ${position.currentPrice.toFixed(2)}
              </span>
              <div className="flex items-center gap-1 text-xs">
                {getTrendIcon()}
                <span className={position.dayChangePct && position.dayChangePct > 0 ? "text-success" : position.dayChangePct && position.dayChangePct < 0 ? "text-destructive" : "text-muted-foreground"}>
                  {position.dayChangePct ? `${position.dayChangePct >= 0 ? '+' : ''}${position.dayChangePct.toFixed(1)}%` : '-'}
                </span>
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground text-sm">-</span>
          )}
        </TableCell>
        <TableCell>
          <div className="flex flex-col gap-1">
            <span>${position.assignment_price.toFixed(2)}</span>
            <span className="text-xs text-muted-foreground">
              Total: ${position.cost_basis.toFixed(2)}
            </span>
          </div>
        </TableCell>
        {/* BREAK-EVEN COLUMN - Highlighted */}
        <TableCell className={`bg-gradient-to-r ${isAboveBreakEven ? 'from-success/10 to-success/5' : 'from-destructive/10 to-destructive/5'} border-x ${isAboveBreakEven ? 'border-success/20' : 'border-destructive/20'}`}>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <span className={`font-bold ${isAboveBreakEven ? 'text-success' : 'text-destructive'}`}>
                ${breakEvenPerShare.toFixed(2)}
              </span>
              {isAboveBreakEven ? (
                <TrendingUp className="w-3.5 h-3.5 text-success" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-destructive" />
              )}
            </div>
            <div className={`text-xs font-medium ${isAboveBreakEven ? 'text-success' : 'text-destructive'}`}>
              {isAboveBreakEven ? '+' : ''}{pctAboveBreakEven.toFixed(1)}% {isAboveBreakEven ? 'above' : 'below'}
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-0.5">
              <div 
                className={`h-full rounded-full transition-all ${isAboveBreakEven ? 'bg-success' : 'bg-destructive'}`}
                style={{ width: `${Math.min(Math.abs(pctAboveBreakEven) * 5, 100)}%` }}
              />
            </div>
          </div>
        </TableCell>
        <TableCell>
          <span className="text-success">
            ${totalPutPremium.toFixed(2)}
          </span>
        </TableCell>
        <TableCell>
          <div className="flex flex-col gap-1">
            <span className="text-success font-medium">
              ${totalCallPremiums.toFixed(2)}
            </span>
            {activeCalls.length > 0 && (
              <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 p-0 text-xs">
                    {isExpanded ? (
                      <>
                        Hide <ChevronUp className="h-3 w-3 ml-1" />
                      </>
                    ) : (
                      <>
                        Details <ChevronDown className="h-3 w-3 ml-1" />
                      </>
                    )}
                  </Button>
                </CollapsibleTrigger>
              </Collapsible>
            )}
          </div>
        </TableCell>
        <TableCell>
          <div className="flex flex-col gap-1">
            <span className={`font-semibold ${position.unrealizedPnL + totalPremiums >= 0 ? "text-success" : "text-destructive"}`}>
              ${(position.unrealizedPnL + totalPremiums).toFixed(2)}
            </span>
            <span className="text-xs text-muted-foreground">
              P/L: ${position.unrealizedPnL.toFixed(0)} + Prem: ${totalPremiums.toFixed(0)}
            </span>
          </div>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center gap-2 justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSellDialogOpen(true)}
              disabled={position.currentPrice <= 0 || freeShares <= 0}
              title={
                position.currentPrice <= 0 
                  ? "Market price unavailable" 
                  : freeShares <= 0 
                    ? "All shares are under call"
                    : `Sell shares at $${position.currentPrice.toFixed(2)}`
              }
            >
              Sell Shares
            </Button>
            <Button
              size="sm"
              onClick={() => onSellCall(position)}
              disabled={freeShares < 100}
              title={freeShares < 100 ? "All shares are under call" : "Sell covered call"}
            >
              Sell Call
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {/* Sell Shares Dialog */}
      <SellSharesDialog
        open={sellDialogOpen}
        onOpenChange={setSellDialogOpen}
        position={position}
        onConfirm={handleSellConfirm}
      />
      
      {/* Expanded Covered Calls Details */}
      {isExpanded && activeCalls.length > 0 && (
        <TableRow>
          <TableCell colSpan={9} className="bg-muted/30">
            <Collapsible open={isExpanded}>
              <CollapsibleContent>
                <div className="space-y-3 py-3">
                  <h4 className="text-sm font-semibold">Active Covered Calls</h4>
                  <div className="grid gap-3">
                    {activeCalls.map((call) => {
                      const status = getCallStatus(call);
                      const potentialGain = calculateCallAwayGain(call);
                      const sharesForCall = call.contracts * 100;
                      const callPremium = call.premium_per_contract * call.contracts * 100;
                      
                      return (
                        <div 
                          key={call.id} 
                          className={`border rounded-lg p-3 ${
                            status.risk === 'high' ? 'border-destructive/50 bg-destructive/5' :
                            status.risk === 'medium' ? 'border-warning/50 bg-warning/5' :
                            'border-border'
                          }`}
                        >
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                              <p className="text-muted-foreground text-xs">Strike / Expiration</p>
                              <p className="font-medium">${call.strike_price.toFixed(2)}</p>
                              <p className="text-xs">{new Date(call.expiration).toLocaleDateString()}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Contracts / Shares</p>
                              <p className="font-medium">{call.contracts} × 100</p>
                              <p className="text-xs text-muted-foreground">{sharesForCall} shares</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Premium Collected</p>
                              <p className="font-medium text-success">${callPremium.toFixed(2)}</p>
                              <p className="text-xs text-muted-foreground">
                                ${call.premium_per_contract.toFixed(2)}/ct
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">If Called Away</p>
                              <p className={`font-medium ${potentialGain >= 0 ? 'text-success' : 'text-destructive'}`}>
                                ${potentialGain.toFixed(2)}
                              </p>
                              <Badge variant={status.variant} className="mt-1 text-xs">
                                {status.label}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};
