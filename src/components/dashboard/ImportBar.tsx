import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export function ImportBar() {
  const [orderText, setOrderText] = useState("");
  const [loading, setLoading] = useState(false);

  const handleParse = async () => {
    if (!orderText.trim()) {
      toast({
        title: "No order text",
        description: "Please paste broker order text to parse.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Parse order using edge function
      const { data: parseResult, error: parseError } = await supabase.functions.invoke('parse-order', {
        body: { orderText },
      });

      if (parseError) throw parseError;

      const positions = parseResult.positions || [parseResult];
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Insert all positions
      const positionsToInsert = positions.map((p: any) => ({
        user_id: user.id,
        raw_order_text: parseResult.raw_order_text || orderText,
        ...p,
      }));

      // Fetch market data for all unique symbols
      const uniqueSymbols = [...new Set(positions.map((p: any) => p.symbol))];
      await Promise.all(
        uniqueSymbols.map(symbol =>
          supabase.functions.invoke('fetch-market-data', { body: { symbol } })
        )
      );

      const { error: insertError } = await supabase
        .from('positions')
        .insert(positionsToInsert);

      if (insertError) throw insertError;

      toast({
        title: "Orders parsed successfully",
        description: `${positions.length} position${positions.length > 1 ? 's' : ''} added to your dashboard.`,
      });
      setOrderText("");
    } catch (error: any) {
      console.error('Parse error:', error);
      toast({
        title: "Failed to parse order",
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
          <div>
            <label className="text-sm font-medium mb-2 block">
              Import Broker Order
            </label>
            <Textarea
              placeholder="Paste broker order text or portfolio export here (supports multiple positions)..."
              value={orderText}
              onChange={(e) => setOrderText(e.target.value)}
              rows={6}
              className="resize-none font-mono text-xs"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleParse} className="flex-1" disabled={loading}>
              <Upload className="mr-2 h-4 w-4" />
              {loading ? "Parsing..." : "Parse & Import"}
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
