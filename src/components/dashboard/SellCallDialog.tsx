import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface SellCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignedPositionId: string;
  symbol: string;
  onSuccess: () => void;
}

export function SellCallDialog({ 
  open, 
  onOpenChange, 
  assignedPositionId, 
  symbol,
  onSuccess 
}: SellCallDialogProps) {
  const [orderText, setOrderText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleParse = async () => {
    if (!orderText.trim()) {
      toast({
        title: "Empty order",
        description: "Please paste your covered call order text",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('parse-covered-call', {
        body: { 
          orderText: orderText.trim(),
          assignedPositionId 
        }
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Covered call added",
        description: `Successfully added covered call for ${symbol}`,
      });

      setOrderText("");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error parsing covered call:", error);
      toast({
        title: "Error parsing order",
        description: error.message || "Failed to parse covered call order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Sell Covered Call - {symbol}</DialogTitle>
          <DialogDescription>
            Paste your broker's covered call order confirmation below. The AI will extract the strike, expiration, premium, and contracts.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <Textarea
            placeholder="Paste your covered call order here...&#10;&#10;Example:&#10;Sold 1 AAPL Dec 20 '24 $150 Call @ $2.50"
            value={orderText}
            onChange={(e) => setOrderText(e.target.value)}
            className="min-h-[150px] font-mono text-sm"
          />
          
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleParse}
              disabled={isProcessing || !orderText.trim()}
            >
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Parse & Add Call
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
