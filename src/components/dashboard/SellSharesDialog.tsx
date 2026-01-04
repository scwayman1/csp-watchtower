import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, AlertTriangle, DollarSign, Percent } from "lucide-react";

interface SellSharesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: {
    id: string;
    symbol: string;
    shares: number;
    assignment_price: number;
    cost_basis: number;
    currentPrice: number;
    original_put_premium: number;
    coveredCallPremiums: number;
    covered_calls?: Array<{ is_active: boolean; contracts: number }>;
  };
  onConfirm: (sharesToSell: number) => void;
}

export const SellSharesDialog = ({
  open,
  onOpenChange,
  position,
  onConfirm,
}: SellSharesDialogProps) => {
  const activeCalls = position.covered_calls?.filter(call => call.is_active) || [];
  const sharesUnderCall = activeCalls.reduce((sum, call) => sum + (call.contracts * 100), 0);
  const freeShares = position.shares - sharesUnderCall;
  
  const [sharesToSell, setSharesToSell] = useState(freeShares);

  // Reset shares when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setSharesToSell(freeShares);
    }
    onOpenChange(newOpen);
  };

  const orderPreview = useMemo(() => {
    const proceeds = sharesToSell * position.currentPrice;
    const costBasisForShares = (position.cost_basis / position.shares) * sharesToSell;
    const capitalGain = proceeds - costBasisForShares;
    const capitalGainPct = costBasisForShares > 0 ? (capitalGain / costBasisForShares) * 100 : 0;
    
    // Calculate premium portion for these shares
    const totalPremiums = position.original_put_premium + position.coveredCallPremiums;
    const premiumPerShare = totalPremiums / position.shares;
    const premiumForSoldShares = premiumPerShare * sharesToSell;
    
    // Total return including premiums already collected
    const totalReturn = capitalGain + premiumForSoldShares;
    
    return {
      proceeds,
      costBasisForShares,
      capitalGain,
      capitalGainPct,
      premiumForSoldShares,
      totalReturn,
    };
  }, [sharesToSell, position]);

  const handleSliderChange = (value: number[]) => {
    setSharesToSell(value[0]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    setSharesToSell(Math.min(Math.max(0, value), freeShares));
  };

  const handleConfirm = () => {
    if (sharesToSell > 0 && sharesToSell <= freeShares) {
      onConfirm(sharesToSell);
      onOpenChange(false);
    }
  };

  const isValidOrder = sharesToSell > 0 && sharesToSell <= freeShares;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Sell {position.symbol} Shares
          </DialogTitle>
          <DialogDescription>
            Review your order before confirming. You can sell a portion of your shares.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Position Summary */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Current Price</span>
              <span className="font-medium">${position.currentPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Avg Cost Basis</span>
              <span>${(position.cost_basis / position.shares).toFixed(2)}/share</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Shares Owned</span>
              <span>{position.shares.toLocaleString()}</span>
            </div>
            {sharesUnderCall > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-warning" />
                  Shares Under Call
                </span>
                <span className="text-warning">{sharesUnderCall}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Available to Sell</span>
              <span className="font-medium text-success">{freeShares}</span>
            </div>
          </div>

          <Separator />

          {/* Shares Selection */}
          <div className="space-y-3">
            <Label htmlFor="shares">Shares to Sell</Label>
            <div className="flex items-center gap-4">
              <Input
                id="shares"
                type="number"
                min={0}
                max={freeShares}
                value={sharesToSell}
                onChange={handleInputChange}
                className="w-24"
              />
              <div className="flex-1">
                <Slider
                  value={[sharesToSell]}
                  onValueChange={handleSliderChange}
                  max={freeShares}
                  min={0}
                  step={1}
                  className="cursor-pointer"
                />
              </div>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0</span>
              <Button 
                variant="link" 
                size="sm" 
                className="h-auto p-0 text-xs"
                onClick={() => setSharesToSell(freeShares)}
              >
                Max: {freeShares}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Order Preview */}
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              Order Preview
              {sharesToSell > 0 && (
                <Badge variant="outline" className="text-xs">
                  {sharesToSell} shares @ ${position.currentPrice.toFixed(2)}
                </Badge>
              )}
            </h4>
            
            <div className="bg-muted/30 rounded-lg p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Gross Proceeds</span>
                <span className="font-medium">
                  ${orderPreview.proceeds.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cost Basis</span>
                <span>
                  -${orderPreview.costBasisForShares.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  Capital Gain/Loss
                  {orderPreview.capitalGain >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-success" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-destructive" />
                  )}
                </span>
                <span className={`font-medium ${orderPreview.capitalGain >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {orderPreview.capitalGain >= 0 ? '+' : ''}
                  ${orderPreview.capitalGain.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  <span className="text-xs text-muted-foreground ml-1">
                    ({orderPreview.capitalGainPct >= 0 ? '+' : ''}{orderPreview.capitalGainPct.toFixed(1)}%)
                  </span>
                </span>
              </div>
              
              {orderPreview.premiumForSoldShares > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Premiums (already collected)</span>
                  <span className="text-success">
                    +${orderPreview.premiumForSoldShares.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              
              <Separator className="my-2" />
              <div className="flex justify-between font-medium">
                <span>Total Return on Position</span>
                <span className={orderPreview.totalReturn >= 0 ? 'text-success' : 'text-destructive'}>
                  {orderPreview.totalReturn >= 0 ? '+' : ''}
                  ${orderPreview.totalReturn.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!isValidOrder}
            className={orderPreview.capitalGain >= 0 ? 'bg-success hover:bg-success/90' : ''}
          >
            Confirm Sale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
