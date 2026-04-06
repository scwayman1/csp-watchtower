import { useState } from "react";
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
import { ShoppingCart } from "lucide-react";

interface BuySharesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: {
    symbol: string;
    shares: number;
    purchasePrice: number;
    purchaseDate: string;
  }) => void;
}

export function BuySharesDialog({ open, onOpenChange, onConfirm }: BuySharesDialogProps) {
  const [symbol, setSymbol] = useState("");
  const [shares, setShares] = useState(100);
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setSymbol("");
      setShares(100);
      setPurchasePrice("");
      setPurchaseDate(new Date().toISOString().split("T")[0]);
    }
    onOpenChange(newOpen);
  };

  const price = parseFloat(purchasePrice) || 0;
  const totalCost = price * shares;
  const isValid = symbol.trim().length > 0 && shares > 0 && price > 0 && purchaseDate;

  const handleConfirm = () => {
    if (!isValid) return;
    onConfirm({
      symbol: symbol.trim().toUpperCase(),
      shares,
      purchasePrice: price,
      purchaseDate,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Record Stock Purchase
          </DialogTitle>
          <DialogDescription>
            Record a direct stock purchase to track alongside your wheel positions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="symbol">Symbol</Label>
            <Input
              id="symbol"
              placeholder="e.g. DIA"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="shares">Shares</Label>
              <Input
                id="shares"
                type="number"
                min={1}
                value={shares}
                onChange={(e) => setShares(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Price per Share</Label>
              <Input
                id="price"
                type="number"
                min={0}
                step={0.01}
                placeholder="0.00"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Purchase Date</Label>
            <Input
              id="date"
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
            />
          </div>

          {price > 0 && shares > 0 && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Cost</span>
                <span className="font-medium">
                  ${totalCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cost Basis / Share</span>
                <span className="font-medium">${price.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!isValid}>
            Record Purchase
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
