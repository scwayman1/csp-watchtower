import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Upload } from "lucide-react";

interface PortfolioIngestionProps {
  onParsed: (cashBalance: number, otherHoldingsValue: number) => void;
}

export function PortfolioIngestion({ onParsed }: PortfolioIngestionProps) {
  const [portfolioText, setPortfolioText] = useState("");
  const [parsing, setParsing] = useState(false);
  const { toast } = useToast();

  const parsePortfolio = () => {
    setParsing(true);
    try {
      const lines = portfolioText.split('\n');
      let cashBalance = 0;
      let otherHoldingsValue = 0;

      for (const line of lines) {
        // Skip empty lines and headers
        if (!line.trim() || line.includes('Symbol') || line.includes('Account value')) continue;

        // Look for lines with dollar amounts (format: $X,XXX.XX or $X.XX)
        const valueMatch = line.match(/\$([0-9,]+\.[0-9]{2})/);
        if (!valueMatch) continue;

        const value = parseFloat(valueMatch[1].replace(/,/g, ''));

        // Skip if it's an option position (contains "PUT" or "CALL")
        if (line.includes('PUT') || line.includes('CALL')) continue;

        // Check if it's a money market fund (FDRXX or similar cash-like instruments)
        if (line.includes('FDRXX') || 
            line.includes('CASH RESERVES') || 
            line.includes('MONEY MARKET') ||
            line.includes('TREASURY')) {
          cashBalance += value;
        } 
        // Check if it's assigned shares we track separately (AMZN, CRM, etc.)
        else if (line.includes('AMZN') || 
                 line.includes('CRM') || 
                 line.includes('AMAZON') || 
                 line.includes('SALESFORCE')) {
          // Skip - these are tracked in assigned_positions table
          continue;
        }
        // Everything else is "other holdings" (mutual funds, bonds, etc.)
        else {
          otherHoldingsValue += value;
        }
      }

      if (cashBalance === 0 && otherHoldingsValue === 0) {
        toast({
          title: "No portfolio data found",
          description: "Please paste your broker's portfolio summary with dollar amounts.",
          variant: "destructive",
        });
        return;
      }

      onParsed(cashBalance, otherHoldingsValue);
      
      toast({
        title: "Portfolio parsed successfully",
        description: `Cash: $${cashBalance.toLocaleString()} | Other Holdings: $${otherHoldingsValue.toLocaleString()}`,
      });
      
      setPortfolioText("");
    } catch (error: any) {
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