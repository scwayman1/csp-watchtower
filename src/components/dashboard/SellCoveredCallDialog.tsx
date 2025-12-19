import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useOptionsChain } from "@/hooks/useOptionsChain";
import { OptionsChain } from "./OptionsChain";

interface SellCoveredCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignedPositionId: string;
  symbol: string;
  maxContracts: number;
  currentPrice: number;
  onSell: (data: {
    learning_assigned_position_id: string;
    strike_price: number;
    expiration: string;
    premium_per_contract: number;
    contracts: number;
  }) => void;
}

export const SellCoveredCallDialog = ({
  open,
  onOpenChange,
  assignedPositionId,
  symbol,
  maxContracts,
  currentPrice,
  onSell,
}: SellCoveredCallDialogProps) => {
  const [contracts, setContracts] = useState(Math.min(1, maxContracts));
  const [selectedExpiration, setSelectedExpiration] = useState<string>("");
  
  const { data: optionChainData, isLoading } = useOptionsChain(symbol, 'CALL');

  const handleAddToSimulator = (optionData: {
    strike_price: number;
    premium_per_contract: number;
    expiration: string;
  }) => {
    onSell({
      learning_assigned_position_id: assignedPositionId,
      strike_price: optionData.strike_price,
      expiration: optionData.expiration,
      premium_per_contract: optionData.premium_per_contract,
      contracts,
    });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sell Covered Call - {symbol}</DialogTitle>
          <DialogDescription>
            Select a call option to sell against your shares (max {maxContracts} contracts)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="contracts">Number of Contracts</Label>
              <Input
                id="contracts"
                type="number"
                value={contracts}
                onChange={(e) => setContracts(Math.min(maxContracts, Math.max(1, parseInt(e.target.value) || 1)))}
                min={1}
                max={maxContracts}
              />
              <p className="text-sm text-muted-foreground">
                Max: {maxContracts} contracts
              </p>
            </div>

            {optionChainData && optionChainData.expirations.length > 0 && (
              <div className="grid gap-2">
                <Label htmlFor="expiration">Expiration Date</Label>
                <Select value={selectedExpiration} onValueChange={setSelectedExpiration}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select expiration date" />
                  </SelectTrigger>
                  <SelectContent>
                    {optionChainData.expirations.map((exp) => {
                      const isoDate = new Date(parseInt(exp) * 1000).toISOString().split('T')[0];
                      const [year, month, day] = isoDate.split('-').map(Number);
                      const localDate = new Date(year, month - 1, day);

                      return (
                        <SelectItem key={exp} value={exp}>
                          {localDate.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Loading call options...</span>
            </div>
          )}

          {!isLoading && optionChainData && selectedExpiration && (
            <div className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Available Call Options</h3>
              <OptionsChain
                underlyingPrice={optionChainData.underlyingPrice}
                options={optionChainData.options[selectedExpiration] || []}
                contracts={contracts}
                expiration={new Date(parseInt(selectedExpiration) * 1000).toISOString().split('T')[0]}
                onAddToSimulator={handleAddToSimulator}
                symbol={symbol}
              />
            </div>
          )}

          {!isLoading && optionChainData && !selectedExpiration && (
            <div className="text-center py-8 text-muted-foreground">
              Select an expiration date to view available call options
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
