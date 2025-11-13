import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface OptionData {
  strike: number;
  lastPrice: number;
  bid: number;
  ask: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  inTheMoney: boolean;
}

interface OptionChainData {
  symbol: string;
  underlyingPrice: number;
  expirations: string[];
  puts: OptionData[];
}

interface OptionPricerProps {
  onAddToSimulator: (position: any) => void;
}

export const OptionPricer = ({ onAddToSimulator }: OptionPricerProps) => {
  const { toast } = useToast();
  const [symbol, setSymbol] = useState("");
  const [loading, setLoading] = useState(false);
  const [optionData, setOptionData] = useState<OptionChainData | null>(null);
  const [selectedExpiration, setSelectedExpiration] = useState("");
  const [contracts, setContracts] = useState("1");

  const fetchOptionChain = async () => {
    if (!symbol) {
      toast({
        title: "Symbol required",
        description: "Please enter a stock symbol",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-option-chain', {
        body: { symbol: symbol.toUpperCase() },
      });

      if (error) throw error;

      setOptionData(data);
      if (data.expirations?.length > 0) {
        setSelectedExpiration(data.expirations[0]);
      }

      toast({
        title: "Option data loaded",
        description: `Found ${data.puts?.length || 0} put contracts for ${data.symbol}`,
      });
    } catch (error) {
      console.error('Error fetching option chain:', error);
      toast({
        title: "Failed to fetch options",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
      setOptionData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToSimulator = (option: OptionData) => {
    if (!optionData || !selectedExpiration) return;

    const premium = (option.bid + option.ask) / 2;
    
    onAddToSimulator({
      symbol: optionData.symbol,
      strike_price: option.strike,
      expiration: selectedExpiration,
      contracts: parseInt(contracts) || 1,
      premium_per_contract: premium,
      notes: `Simulated trade - IV: ${(option.impliedVolatility * 100).toFixed(1)}%`,
    });
  };

  const calculateROC = (strike: number, premium: number) => {
    const cashSecured = strike * 100 * parseInt(contracts || "1");
    const totalPremium = premium * 100 * parseInt(contracts || "1");
    return ((totalPremium / cashSecured) * 100).toFixed(2);
  };

  const getDaysToExpiration = (expDate: string) => {
    const today = new Date();
    const exp = new Date(expDate);
    const diffTime = exp.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="symbol">Stock Symbol</Label>
          <Input
            id="symbol"
            placeholder="AAPL"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && fetchOptionChain()}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contracts">Contracts</Label>
          <Input
            id="contracts"
            type="number"
            min="1"
            value={contracts}
            onChange={(e) => setContracts(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expiration">Expiration</Label>
          <Select 
            value={selectedExpiration} 
            onValueChange={setSelectedExpiration}
            disabled={!optionData || !optionData.expirations || optionData.expirations.length === 0}
          >
            <SelectTrigger id="expiration" className="disabled:cursor-not-allowed disabled:opacity-60">
              <SelectValue placeholder={optionData ? "Select expiration" : "Fetch prices first"} />
            </SelectTrigger>
            <SelectContent className="z-[200]" position="popper" sideOffset={4}>
              {optionData?.expirations.map((exp) => (
                <SelectItem key={exp} value={exp}>
                  {exp} ({getDaysToExpiration(exp)} days)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!optionData && (
            <p className="text-xs text-muted-foreground">
              Enter a symbol and click "Get Prices" to view available expirations
            </p>
          )}
        </div>
        <div className="flex items-end">
          <Button onClick={fetchOptionChain} disabled={loading} className="w-full">
            <Search className="mr-2 h-4 w-4" />
            {loading ? "Loading..." : "Get Prices"}
          </Button>
        </div>
      </div>

      {optionData && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">{optionData.symbol} Put Options</h3>
              <p className="text-sm text-muted-foreground">
                Current Price: ${optionData.underlyingPrice.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Strike</TableHead>
                  <TableHead>Premium</TableHead>
                  <TableHead>ROC</TableHead>
                  <TableHead>IV</TableHead>
                  <TableHead>Volume</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {optionData.puts
                  .filter(put => put.strike <= optionData.underlyingPrice * 1.1)
                  .sort((a, b) => b.strike - a.strike)
                  .slice(0, 20)
                  .map((option, idx) => {
                    const premium = (option.bid + option.ask) / 2;
                    const roc = calculateROC(option.strike, premium);
                    const pctFromCurrent = ((optionData.underlyingPrice - option.strike) / optionData.underlyingPrice * 100);
                    
                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">${option.strike}</TableCell>
                        <TableCell>${premium.toFixed(2)}</TableCell>
                        <TableCell>{roc}%</TableCell>
                        <TableCell>{(option.impliedVolatility * 100).toFixed(1)}%</TableCell>
                        <TableCell>{option.volume}</TableCell>
                        <TableCell>
                          {option.inTheMoney ? (
                            <Badge variant="destructive">ITM</Badge>
                          ) : pctFromCurrent < 5 ? (
                            <Badge variant="outline" className="border-warning text-warning">
                              ATM
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-success text-success">
                              OTM
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAddToSimulator(option)}
                          >
                            <Plus className="mr-1 h-3 w-3" />
                            Add
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
};