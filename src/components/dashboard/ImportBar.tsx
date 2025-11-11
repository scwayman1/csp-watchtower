import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function ImportBar() {
  const [orderText, setOrderText] = useState("");

  const handleParse = () => {
    if (!orderText.trim()) {
      toast({
        title: "No order text",
        description: "Please paste broker order text to parse.",
        variant: "destructive",
      });
      return;
    }

    // Mock parsing success
    toast({
      title: "Order parsed successfully",
      description: "Position added to your dashboard.",
    });
    setOrderText("");
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Import Broker Order
            </label>
            <Textarea
              placeholder="Paste broker order text here (e.g., 'SELL TO OPEN 10 ACVA 2025-11-28 5.00 PUT @ 0.35')..."
              value={orderText}
              onChange={(e) => setOrderText(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleParse} className="flex-1">
              <Upload className="mr-2 h-4 w-4" />
              Parse & Import
            </Button>
            <Button variant="outline" onClick={() => setOrderText("")}>
              Clear
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
