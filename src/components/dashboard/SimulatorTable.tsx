import { useMemo, useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, CheckCircle, TrendingUp, TrendingDown, Minus, DollarSign } from "lucide-react";
import { LearningPosition } from "@/hooks/useLearningPositions";
import { useLearningAssignedPositions } from "@/hooks/useLearningAssignedPositions";
import { useLearningMarketData } from "@/hooks/useLearningMarketData";
import { useSimulatorSettings } from "@/hooks/useSimulatorSettings";
import { useSimulatorPortfolioHistory } from "@/hooks/useSimulatorPortfolioHistory";
import { useLearningExpiredPositions } from "@/hooks/useLearningExpiredPositions";
import { useLearningCallExpiration } from "@/hooks/useLearningCallExpiration";
import { SellCoveredCallDialog } from "./SellCoveredCallDialog";
import { SimulatorPerformanceChart } from "./SimulatorPerformanceChart";
import { SimulatorMetrics } from "./SimulatorMetrics";
import { LearningExpiredBatches } from "./LearningExpiredBatches";
import { SimulatorAssignedZone } from "./SimulatorAssignedZone";

interface SimulatorTableProps {
  positions: LearningPosition[];
  onClose: (id: string) => void;
  onDelete: (id: string) => void;
  userId?: string;
}

export const SimulatorTable = ({ positions, onClose, onDelete, userId }: SimulatorTableProps) => {
  const { assignedPositions, closedPositions, assignPosition, sellCoveredCall, closeAssignedPosition } = useLearningAssignedPositions(userId);
  const { settings, updateSettings } = useSimulatorSettings(userId);
  const { history, recordSnapshot } = useSimulatorPortfolioHistory(userId);
  const { batches: expiredBatches, expiredPositions } = useLearningExpiredPositions(userId);
  const [capital, setCapital] = useState(settings?.starting_capital?.toString() || "100000");
  const [selectedAssignedPosition, setSelectedAssignedPosition] = useState<string | null>(null);

  // Auto-process expired covered calls to free up shares
  useLearningCallExpiration(userId, assignedPositions);

  // Update capital when settings load
  useEffect(() => {
    if (settings?.starting_capital) {
      setCapital(settings.starting_capital.toString());
    }
  }, [settings?.starting_capital]);
  
  // Get all unique symbols
  const allSymbols = useMemo(() => {
    const symbols = new Set<string>();
    positions.forEach(p => symbols.add(p.symbol));
    assignedPositions.forEach(ap => symbols.add(ap.symbol));
    return Array.from(symbols);
  }, [positions, assignedPositions]);

  const { data: marketData = {} } = useLearningMarketData(allSymbols);

  // Calculate metrics for each position
  const enhancedPositions = useMemo(() => {
    return positions.map(pos => {
      const priceData = marketData[pos.symbol];
      const underlyingPrice = priceData?.price || 0;
      const dayChangePct = priceData?.change_pct || 0;
      const currentMarkPrice = pos.premium_per_contract; // Using original premium as placeholder

      // Calculate metrics
      const cashSecured = pos.strike_price * 100 * pos.contracts;
      const totalPremium = pos.premium_per_contract * 100 * pos.contracts;
      const currentValue = currentMarkPrice * 100 * pos.contracts;
      const unrealizedPnL = totalPremium - currentValue;
      const roc = ((totalPremium / cashSecured) * 100);
      
      const daysToExp = Math.ceil((new Date(pos.expiration).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      const pctAboveStrike = underlyingPrice > 0 ? ((underlyingPrice - pos.strike_price) / pos.strike_price * 100) : 0;

      return {
        ...pos,
        underlyingPrice,
        dayChangePct,
        cashSecured,
        totalPremium,
        unrealizedPnL,
        roc,
        daysToExp,
        pctAboveStrike,
        currentValue,
      };
    });
  }, [positions, marketData]);

  // Enhanced assigned positions with market data
  const enhancedAssignedPositions = useMemo(() => {
    return assignedPositions.map(ap => {
      const priceData = marketData[ap.symbol];
      const currentPrice = priceData?.price || 0;
      const dayChangePct = priceData?.change_pct || 0;
      const marketValue = currentPrice * ap.shares;
      const unrealizedPnL = marketValue - ap.cost_basis + ap.original_put_premium;
      
      // Calculate covered call premiums (ALL calls, not just active - premium is always kept)
      const coveredCallPremiums = (ap.covered_calls || [])
        .reduce((sum, cc) => sum + (parseFloat(String(cc.premium_per_contract)) * 100 * cc.contracts), 0);

      return {
        ...ap,
        currentPrice,
        dayChangePct,
        marketValue,
        unrealizedPnL,
        coveredCallPremiums,
      };
    });
  }, [assignedPositions, marketData]);

  const totalCashSecured = enhancedPositions.reduce((sum, p) => sum + p.cashSecured, 0);
  const totalPutPremiums = enhancedPositions.reduce((sum, p) => sum + p.totalPremium, 0);
  const totalUnrealizedPnL = enhancedPositions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
  
  const totalAssignedValue = enhancedAssignedPositions.reduce((sum, ap) => sum + ap.marketValue, 0);
  const totalAssignedCostBasis = enhancedAssignedPositions.reduce((sum, ap) => sum + ap.cost_basis, 0);
  const totalCallPremiums = enhancedAssignedPositions.reduce((sum, ap) => sum + ap.coveredCallPremiums, 0);
  const totalAssignedPutPremiums = enhancedAssignedPositions.reduce((sum, ap) => sum + ap.original_put_premium, 0);
  const totalAssignedPnL = enhancedAssignedPositions.reduce((sum, ap) => sum + ap.unrealizedPnL, 0);

  // Include expired positions premium in totals
  const totalExpiredPremiums = expiredPositions.reduce((sum, p) => sum + p.totalPremium, 0);

  // Total premiums collected across all sources
  const totalPremiums = totalPutPremiums + totalCallPremiums + totalExpiredPremiums + totalAssignedPutPremiums;
  
  // Capital gains and proceeds from sold assigned positions
  const { totalCapitalGains, totalSaleProceeds } = closedPositions.reduce((acc, cp) => {
    if (cp.sold_price && cp.shares) {
      const proceeds = cp.sold_price * cp.shares;
      const gain = proceeds - cp.cost_basis;
      return {
        totalCapitalGains: acc.totalCapitalGains + gain,
        totalSaleProceeds: acc.totalSaleProceeds + proceeds,
      };
    }
    return acc;
  }, { totalCapitalGains: 0, totalSaleProceeds: 0 });
  
  // Available Capital = Starting Capital - Cash Secured - Assigned Cost Basis + All Premiums + Sale Proceeds
  // Note: Sale proceeds already include the cost basis recovery + capital gain
  const availableCapital = (parseFloat(capital) || 0) - totalCashSecured - totalAssignedCostBasis + totalPremiums + totalSaleProceeds;
  const totalPortfolioValue = parseFloat(capital) + totalPremiums + totalCapitalGains;

  const handleAssign = async (position: any) => {
    assignPosition({
      symbol: position.symbol,
      shares: position.contracts * 100,
      assignment_price: position.strike_price,
      original_put_premium: position.totalPremium,
      original_learning_position_id: position.id,
    });
    onClose(position.id);
    
    // Record snapshot for assignment
    const newAssignedValue = position.strike_price * position.contracts * 100;
    await recordSnapshot({
      portfolio_value: totalPortfolioValue,
      cash_balance: availableCapital - newAssignedValue,
      positions_value: totalCashSecured - position.cashSecured,
      assigned_shares_value: totalAssignedValue + newAssignedValue,
      total_premiums_collected: totalPremiums,
      event_type: 'position_assigned',
      event_description: `Assigned ${position.contracts * 100} shares of ${position.symbol} at $${position.strike_price}`,
    });
  };

  const handleClose = async (position: any) => {
    onClose(position.id);
    
    // Record snapshot for position close
    await recordSnapshot({
      portfolio_value: totalPortfolioValue + position.totalPremium,
      cash_balance: availableCapital + position.cashSecured,
      positions_value: totalCashSecured - position.cashSecured,
      assigned_shares_value: totalAssignedValue,
      total_premiums_collected: totalPremiums,
      event_type: 'position_closed',
      event_description: `Closed ${position.symbol} $${position.strike_price}P - Premium: $${position.totalPremium.toFixed(2)}`,
    });
  };

  const handleSellCoveredCall = async (data: any) => {
    sellCoveredCall(data);
    
    const premium = data.premium_per_contract * 100 * data.contracts;
    // Record snapshot for covered call
    await recordSnapshot({
      portfolio_value: totalPortfolioValue + premium,
      cash_balance: availableCapital + premium,
      positions_value: totalCashSecured,
      assigned_shares_value: totalAssignedValue,
      total_premiums_collected: totalPremiums + premium,
      event_type: 'covered_call_sold',
      event_description: `Sold covered call on ${selectedPosition?.symbol} - Premium: $${premium.toFixed(2)}`,
    });
    setSelectedAssignedPosition(null);
  };

  const handleSellAssignedShares = async (position: typeof enhancedAssignedPositions[0], sharesToSell: number) => {
    const soldPrice = position.currentPrice;
    if (soldPrice <= 0 || sharesToSell <= 0) return;
    
    closeAssignedPosition({ id: position.id, sold_price: soldPrice, shares_to_sell: sharesToSell });
    
    // Record snapshot for selling shares
    const proceeds = soldPrice * sharesToSell;
    const costBasisForShares = (position.cost_basis / position.shares) * sharesToSell;
    const capitalGain = proceeds - costBasisForShares;
    const marketValueSold = soldPrice * sharesToSell;
    
    await recordSnapshot({
      portfolio_value: totalPortfolioValue + capitalGain,
      cash_balance: availableCapital + proceeds,
      positions_value: totalCashSecured,
      assigned_shares_value: totalAssignedValue - marketValueSold,
      total_premiums_collected: totalPremiums,
      event_type: 'shares_sold',
      event_description: `Sold ${sharesToSell} shares of ${position.symbol} at $${soldPrice.toFixed(2)} - P/L: $${capitalGain.toFixed(2)}`,
    });
  };

  const handleCapitalUpdate = () => {
    const amount = parseFloat(capital);
    if (!isNaN(amount) && amount > 0) {
      updateSettings(amount);
    }
  };

  const selectedPosition = enhancedAssignedPositions.find(ap => ap.id === selectedAssignedPosition);

  // Record initial snapshot when first position is opened (check if no history exists)
  const handleRecordInitialSnapshot = async () => {
    if (history.length === 0 && (positions.length > 0 || assignedPositions.length > 0)) {
      await recordSnapshot({
        portfolio_value: totalPortfolioValue,
        cash_balance: availableCapital,
        positions_value: totalCashSecured,
        assigned_shares_value: totalAssignedValue,
        total_premiums_collected: totalPremiums,
        event_type: 'position_opened',
        event_description: 'Initial position opened',
      });
    }
  };

  // Track position changes to record snapshots
  useEffect(() => {
    if (userId && (positions.length > 0 || assignedPositions.length > 0)) {
      handleRecordInitialSnapshot();
    }
  }, [positions.length, assignedPositions.length, userId]);

  // Auto-assignment logic: check for expired ITM positions
  useEffect(() => {
    if (!userId || enhancedPositions.length === 0) return;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    enhancedPositions.forEach(async (pos) => {
      const expirationDate = new Date(pos.expiration);
      expirationDate.setHours(23, 59, 59, 999);
      
      // Check if position has expired
      const isExpired = expirationDate < today;
      
      // Check if ITM (underlying price is below strike for puts)
      const isITM = pos.underlyingPrice > 0 && pos.underlyingPrice < pos.strike_price;
      
      if (isExpired && isITM) {
        // Auto-assign the position
        console.log(`Auto-assigning ${pos.symbol}: Expired ITM (Price: $${pos.underlyingPrice.toFixed(2)}, Strike: $${pos.strike_price})`);
        
        assignPosition({
          symbol: pos.symbol,
          shares: pos.contracts * 100,
          assignment_price: pos.strike_price,
          original_put_premium: pos.totalPremium,
          original_learning_position_id: pos.id,
        });
        onClose(pos.id);
        
        // Record snapshot for auto-assignment
        const newAssignedValue = pos.strike_price * pos.contracts * 100;
        await recordSnapshot({
          portfolio_value: totalPortfolioValue,
          cash_balance: availableCapital - newAssignedValue,
          positions_value: totalCashSecured - pos.cashSecured,
          assigned_shares_value: totalAssignedValue + newAssignedValue,
          total_premiums_collected: totalPremiums,
          event_type: 'auto_assigned',
          event_description: `Auto-assigned ${pos.contracts * 100} shares of ${pos.symbol} at $${pos.strike_price} (Expired ITM)`,
        });
      } else if (isExpired && !isITM && pos.underlyingPrice > 0) {
        // Position expired OTM - close it and keep premium
        console.log(`Auto-closing ${pos.symbol}: Expired OTM (Price: $${pos.underlyingPrice.toFixed(2)}, Strike: $${pos.strike_price})`);
        
        onClose(pos.id);
        
        // Record snapshot for expiration
        await recordSnapshot({
          portfolio_value: totalPortfolioValue + pos.totalPremium,
          cash_balance: availableCapital + pos.cashSecured,
          positions_value: totalCashSecured - pos.cashSecured,
          assigned_shares_value: totalAssignedValue,
          total_premiums_collected: totalPremiums,
          event_type: 'expired_otm',
          event_description: `${pos.symbol} $${pos.strike_price}P expired worthless - Kept premium: $${pos.totalPremium.toFixed(2)}`,
        });
      }
    });
  }, [enhancedPositions, userId]);

  return (
    <div className="space-y-6">
      {/* Performance Metrics - Annualized ROC & Month-over-Month */}
      <SimulatorMetrics
        history={history}
        startingCapital={parseFloat(capital) || 100000}
        totalPremiums={totalPremiums}
        totalCashSecured={totalCashSecured}
        totalAssignedCostBasis={totalAssignedCostBasis}
        totalPortfolioValue={totalPortfolioValue}
        currentPortfolioValue={totalPortfolioValue}
        currentTotalPremiums={totalPremiums}
        allPositions={positions}
        expiredPositions={expiredPositions}
      />

      {/* Performance Chart */}
      <SimulatorPerformanceChart 
        history={history} 
        startingCapital={parseFloat(capital) || 100000} 
      />

      {/* Capital Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Simulator Capital
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="capital">Starting Capital</Label>
              <Input
                id="capital"
                type="number"
                step="1000"
                value={capital}
                onChange={(e) => setCapital(e.target.value)}
                placeholder="100000"
              />
            </div>
            <Button onClick={handleCapitalUpdate}>Update</Button>
          </div>
        </CardContent>
      </Card>

      {/* Portfolio Summary */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Capital</p>
            <p className="text-2xl font-bold">${parseFloat(capital).toLocaleString('en-US', { minimumFractionDigits: 0 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Portfolio Value</p>
            <p className="text-2xl font-bold">${totalPortfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Premiums</p>
            <p className="text-2xl font-bold text-success">${totalPremiums.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Capital Gains</p>
            <p className={`text-2xl font-bold ${totalCapitalGains >= 0 ? 'text-success' : 'text-destructive'}`}>
              {totalCapitalGains >= 0 ? '+' : ''}${totalCapitalGains.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Available Cash</p>
            <p className={`text-2xl font-bold ${availableCapital >= 0 ? 'text-success' : 'text-destructive'}`}>
              ${availableCapital.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Put Positions */}
      {positions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Put Positions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Current Price</TableHead>
                    <TableHead>Strike</TableHead>
                    <TableHead>Expiration</TableHead>
                    <TableHead>Contracts</TableHead>
                    <TableHead>Premium</TableHead>
                    <TableHead>% Above</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enhancedPositions.map((pos) => (
                    <TableRow key={pos.id}>
                      <TableCell className="font-medium">{pos.symbol}</TableCell>
                      <TableCell>
                        {pos.underlyingPrice > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-sm">${pos.underlyingPrice.toFixed(2)}</span>
                            <div className="flex items-center gap-1">
                              {pos.dayChangePct > 0 ? (
                                <TrendingUp className="w-3 h-3 text-success" />
                              ) : pos.dayChangePct < 0 ? (
                                <TrendingDown className="w-3 h-3 text-destructive" />
                              ) : (
                                <Minus className="w-3 h-3 text-muted-foreground" />
                              )}
                              <span className={`text-xs ${pos.dayChangePct > 0 ? "text-success" : pos.dayChangePct < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                                {pos.dayChangePct ? `${pos.dayChangePct >= 0 ? '+' : ''}${pos.dayChangePct.toFixed(1)}%` : '-'}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>${pos.strike_price}</TableCell>
                      <TableCell>
                        {pos.expiration}
                        <span className="text-xs text-muted-foreground ml-2">
                          ({pos.daysToExp}d)
                        </span>
                      </TableCell>
                      <TableCell>{pos.contracts}</TableCell>
                      <TableCell>${pos.premium_per_contract.toFixed(2)}</TableCell>
                      <TableCell>
                        {pos.underlyingPrice > 0 ? (
                          <Badge 
                            variant={
                              pos.pctAboveStrike >= 10 ? "outline" :
                              pos.pctAboveStrike >= 5 ? "secondary" :
                              "destructive"
                            }
                            className={
                              pos.pctAboveStrike >= 10 ? "border-success text-success" :
                              pos.pctAboveStrike >= 5 ? "border-warning text-warning" :
                              ""
                            }
                          >
                            {pos.pctAboveStrike.toFixed(1)}%
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleAssign(pos)}
                            title="Assign position (simulate assignment)"
                          >
                            Assign
                          </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleClose(pos)}
                            title="Close position"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onDelete(pos.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assigned Positions Zone */}
      <SimulatorAssignedZone
        assignedPositions={enhancedAssignedPositions}
        onSellCall={(pos) => setSelectedAssignedPosition(pos.id)}
        onSellShares={handleSellAssignedShares}
      />

      {/* Expired Positions (Vintage Cards) */}
      <LearningExpiredBatches batches={expiredBatches} />

      {positions.length === 0 && assignedPositions.length === 0 && expiredBatches.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No practice positions yet.</p>
          <p className="text-sm mt-2">Use the Options Chain to add positions to your simulator.</p>
        </div>
      )}

      {selectedPosition && (
        <SellCoveredCallDialog
          open={!!selectedAssignedPosition}
          onOpenChange={(open) => !open && setSelectedAssignedPosition(null)}
          assignedPositionId={selectedPosition.id}
          symbol={selectedPosition.symbol}
          maxContracts={Math.floor(selectedPosition.shares / 100)}
          currentPrice={selectedPosition.currentPrice || 0}
          onSell={handleSellCoveredCall}
        />
      )}
    </div>
  );
};