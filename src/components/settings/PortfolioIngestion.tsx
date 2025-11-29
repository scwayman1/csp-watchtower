import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface PortfolioIngestionProps {
  onParsed: (cashBalance: number, otherHoldingsValue: number) => void;
}

export function PortfolioIngestion({ onParsed }: PortfolioIngestionProps) {
  const [portfolioText, setPortfolioText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [trackedSymbols, setTrackedSymbols] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadTrackedSymbols();
    }
  }, [user]);

  const loadTrackedSymbols = async () => {
    try {
      const [assignedRes, activeRes] = await Promise.all([
        supabase
          .from('assigned_positions')
          .select('symbol')
          .eq('user_id', user!.id)
          .eq('is_active', true),
        supabase
          .from('positions')
          .select('symbol')
          .eq('user_id', user!.id)
          .eq('is_active', true)
      ]);

      const symbols = new Set<string>();
      assignedRes.data?.forEach(p => symbols.add(p.symbol.toUpperCase()));
      activeRes.data?.forEach(p => symbols.add(p.symbol.toUpperCase()));
      
      setTrackedSymbols(symbols);
    } catch (error) {
      console.error('Error loading tracked symbols:', error);
    }
  };

  const parsePortfolio = () => {
    setParsing(true);
    try {
      const lines = portfolioText.split('\n');
      let cashBalance = 0;
      let otherHoldingsValue = 0;
      let skippedCount = 0;
      let processedLines = 0;

      console.log('Starting portfolio parse...', { totalLines: lines.length, trackedSymbols: Array.from(trackedSymbols) });

      for (const line of lines) {
        // Skip empty lines and headers
        if (!line.trim() || line.includes('Symbol') || line.includes('Account value')) continue;

        // Look for lines with dollar amounts (format: $X,XXX.XX or $X.XX)
        const valueMatch = line.match(/\$([0-9,]+\.[0-9]{2})/);
        if (!valueMatch) continue;

        const value = parseFloat(valueMatch[1].replace(/,/g, ''));
        processedLines++;

        // Skip if it's an option position (contains "PUT" or "CALL")
        if (line.includes('PUT') || line.includes('CALL')) {
          console.log('Skipping option:', line.substring(0, 50));
          skippedCount++;
          continue;
        }

        // Check if it's a money market fund (FDRXX or similar cash-like instruments)
        if (line.includes('FDRXX') || 
            line.includes('CASH RESERVES') || 
            line.includes('MONEY MARKET') ||
            line.includes('TREASURY')) {
          console.log('Found cash:', value, line.substring(0, 50));
          cashBalance += value;
        } 
        // Check if it's a symbol we're already tracking in positions or assigned_positions
        else {
          const isTracked = Array.from(trackedSymbols).some(symbol => 
            line.toUpperCase().includes(symbol)
          );
          
          if (isTracked) {
            console.log('Skipping tracked symbol:', line.substring(0, 50));
            skippedCount++;
            continue;
          }
          
          console.log('Found other holding:', value, line.substring(0, 50));
          otherHoldingsValue += value;
        }
      }

      console.log('Parse complete:', { cashBalance, otherHoldingsValue, processedLines, skippedCount });

      if (cashBalance === 0 && otherHoldingsValue === 0) {
        toast({
          title: "No portfolio data found",
          description: `Processed ${processedLines} lines but found no cash or holdings. Check format: lines should contain dollar amounts like $1,234.56`,
          variant: "destructive",
        });
        return;
      }

      onParsed(cashBalance, otherHoldingsValue);
      
      toast({
        title: "Portfolio parsed successfully",
        description: `Cash: $${cashBalance.toLocaleString()} | Other Holdings: $${otherHoldingsValue.toLocaleString()} | Skipped: ${skippedCount} items`,
      });
      
      setPortfolioText("");
    } catch (error: any) {
      console.error('Parsing error:', error);
      toast({
        title: "Parsing failed",
        description: error.message || "Could not parse portfolio data",
        variant: "destructive",
      });
    } finally {
      setParsing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Portfolio Import</CardTitle>
        <CardDescription>
          Paste your broker's portfolio summary to automatically populate cash balance and other holdings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="Paste your broker portfolio here (e.g., from Fidelity account summary)
Example:
FDRXX FIDELITY GOVERNMENT CASH RESERVES $1.00 670,497.410 0.00% $670,497.41
OWSCX 1WS CREDIT INCOME FUND INSTL $19.52 2,545.507 0.10% $49,688.29
AMZN AMAZON.COM INC $233.22 200.000 1.77% $46,644.00"
          value={portfolioText}
          onChange={(e) => setPortfolioText(e.target.value)}
          className="min-h-[200px] font-mono text-sm"
        />
        <div className="flex justify-between items-center">
          <p className="text-xs text-muted-foreground">
            Automatically extracts cash balance and other holdings. Ignores options and tracked shares.
          </p>
          <Button 
            onClick={parsePortfolio} 
            disabled={!portfolioText.trim() || parsing}
            size="sm"
          >
            <Upload className="mr-2 h-4 w-4" />
            {parsing ? "Parsing..." : "Parse & Import"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}