import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SellCoveredCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignedPositionId: string;
  symbol: string;
  maxContracts: number;
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
  onSell,
}: SellCoveredCallDialogProps) => {
  const [strikePrice, setStrikePrice] = useState("");
  const [expiration, setExpiration] = useState("");
  const [premium, setPremium] = useState("");
  const [contracts, setContracts] = useState("1");

  const handleSell = () => {
    if (!strikePrice || !expiration || !premium || !contracts) return;

    onSell({
      learning_assigned_position_id: assignedPositionId,
      strike_price: parseFloat(strikePrice),
      expiration,
      premium_per_contract: parseFloat(premium),
      contracts: parseInt(contracts),
    });

    // Reset form
    setStrikePrice("");
    setExpiration("");
    setPremium("");
    setContracts("1");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sell Covered Call - {symbol}</DialogTitle>
          <DialogDescription>
            Enter the details for the covered call you want to sell
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="strike">Strike Price</Label>
            <Input
              id="strike"
              type="number"
              step="0.01"
              placeholder="e.g., 150.00"
              value={strikePrice}
              onChange={(e) => setStrikePrice(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="expiration">Expiration Date</Label>
            <Input
              id="expiration"
              type="date"
              value={expiration}
              onChange={(e) => setExpiration(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="premium">Premium Per Contract</Label>
            <Input
              id="premium"
              type="number"
              step="0.01"
              placeholder="e.g., 2.50"
              value={premium}
              onChange={(e) => setPremium(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="contracts">Contracts (max {maxContracts})</Label>
            <Input
              id="contracts"
              type="number"
              min="1"
              max={maxContracts}
              value={contracts}
              onChange={(e) => setContracts(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSell}>Sell Call</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};