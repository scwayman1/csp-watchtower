import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AssignPositionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: {
    id: string;
    symbol: string;
    strikePrice: number;
    contracts: number;
    totalPremium: number;
    expiration: string;
    underlyingPrice: number;
    pctAboveStrike: number;
  };
  onSuccess: () => Promise<void>;
}

export function AssignPositionDialog({ 
  open, 
  onOpenChange, 
  position,
  onSuccess 
}: AssignPositionDialogProps) {
  const today = new Date().toISOString().split('T')[0];
  const [assignmentDate, setAssignmentDate] = useState(today);
  const [assignmentPrice, setAssignmentPrice] = useState(position.strikePrice.toString());
  const [isProcessing, setIsProcessing] = useState(false);

  const shares = position.contracts * 100;
  const costBasis = parseFloat(assignmentPrice) - (position.totalPremium / shares);
  const isITM = position.underlyingPrice < position.strikePrice;

  const handleAssign = async () => {
    if (!assignmentDate || !assignmentPrice) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create assigned position
      const { error: assignError } = await supabase
        .from('assigned_positions')
        .insert({
          user_id: user.id,
          symbol: position.symbol,
          shares: shares,
          assignment_date: assignmentDate,
          assignment_price: parseFloat(assignmentPrice),
          original_put_premium: position.totalPremium,
          cost_basis: costBasis,
          original_position_id: position.id,
          is_active: true,
        });

      if (assignError) throw assignError;

      // Mark original position as inactive (closed)
      const { error: closeError } = await supabase
        .from('positions')
        .update({ 
          is_active: false,
          closed_at: assignmentDate 
        })
        .eq('id', position.id);

      if (closeError) throw closeError;

      toast({
        title: "Position assigned",
        description: `Successfully assigned ${shares} shares of ${position.symbol} at $${parseFloat(assignmentPrice).toFixed(2)}`,
      });

      onOpenChange(false);
      await onSuccess();
    } catch (error: any) {
      console.error("Error assigning position:", error);
      toast({
        title: "Error assigning position",
        description: error.message || "Failed to record assignment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Assign Position - {position.symbol}</DialogTitle>
          <DialogDescription>
            Record the assignment of your put position. Shares will be added to your Assigned Positions table.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {!isITM && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Note: This position is currently {position.pctAboveStrike.toFixed(1)}% above strike (OTM). 
                Verify it was actually assigned before recording.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="assignmentDate">Assignment Date</Label>
            <Input
              id="assignmentDate"
              type="date"
              value={assignmentDate}
              onChange={(e) => setAssignmentDate(e.target.value)}
              max={today}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignmentPrice">Assignment Price</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">$</span>
              <Input
                id="assignmentPrice"
                type="number"
                step="0.01"
                value={assignmentPrice}
                onChange={(e) => setAssignmentPrice(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Usually the strike price (${position.strikePrice.toFixed(2)})
            </p>
          </div>

          <div className="rounded-lg bg-muted p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Shares:</span>
              <span className="font-semibold">{shares}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Original Premium Collected:</span>
              <span className="font-semibold text-success">
                ${position.totalPremium.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cost Basis per Share:</span>
              <span className="font-semibold">
                ${costBasis.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t">
              <span className="text-muted-foreground">Total Cost Basis:</span>
              <span className="font-bold">
                ${(costBasis * shares).toFixed(2)}
              </span>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={isProcessing}
            >
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record Assignment
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
