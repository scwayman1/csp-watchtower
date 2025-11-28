import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface CoveredCallImportBarProps {
  onSuccess?: () => void;
}

export function CoveredCallImportBar({ onSuccess }: CoveredCallImportBarProps) {
  const [orderText, setOrderText] = useState("");
  const [loading, setLoading] = useState(false);

  const handleParse = async () => {
    if (!orderText.trim()) {
      toast({
        title: "No order text",
        description: "Please paste covered call order text to parse.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Parse covered calls using edge function
      const { data: parseResult, error: parseError } = await supabase.functions.invoke('parse-covered-calls', {
        body: { orderText },
      });

      if (parseError) throw parseError;

      const { inserted, unmatched } = parseResult;

      let description = `${inserted} covered call${inserted !== 1 ? 's' : ''} added successfully.`;
      if (unmatched > 0) {
        description += ` ${unmatched} order${unmatched !== 1 ? 's' : ''} could not be matched to assigned positions.`;
      }

      toast({
        title: inserted > 0 ? "Covered calls imported" : "No matches found",
        description,
        variant: inserted > 0 ? "default" : "destructive",
      });
      
      if (inserted > 0) {
        setOrderText("");
        if (onSuccess) onSuccess();
      }
    } catch (error: any) {
      console.error('Parse error:', error);
      toast({
        title: "Failed to parse orders",
        description: error.message || "Please check the format and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              Import Covered Call Orders
            </label>
            <Badge variant="outline" className="text-xs">
              <CheckCircle className="mr-1 h-3 w-3" />
              Auto-matches to assigned positions
            </Badge>
          </div>
          <Textarea
            placeholder="Paste covered call order text here (supports multiple orders)...
Example formats:
• STO AAPL 01/17/2025 150C x2 @2.50
• Sold 1 Contract TSLA Dec 20 2024 400 Call @ 5.00"
            value={orderText}
            onChange={(e) => setOrderText(e.target.value)}
            rows={6}
            className="resize-none font-mono text-xs"
          />
          <div className="flex gap-2">
            <Button onClick={handleParse} className="flex-1" disabled={loading}>
              <Upload className="mr-2 h-4 w-4" />
              {loading ? "Parsing..." : "Parse & Import Calls"}
            </Button>
            <Button variant="outline" onClick={() => setOrderText("")} disabled={loading}>
              Clear
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
