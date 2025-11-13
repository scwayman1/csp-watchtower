import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

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

  const formatExpiration = (expDate: string) => {
    const date = new Date(expDate);
    const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const day = date.getDate();
    return `${month} ${day}`;
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-4 items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="symbol">Stock Symbol</Label>
          <div className="flex gap-2">
            <Input
              id="symbol"
              placeholder="Enter symbol (e.g., AAPL)"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && fetchOptionChain()}
              className="flex-1"
            />
            <Button onClick={fetchOptionChain} disabled={loading}>
              <Search className="mr-2 h-4 w-4" />
              {loading ? "Loading..." : "Get Quotes"}
            </Button>
          </div>
        </div>
        <div className="w-32 space-y-2">
          <Label htmlFor="contracts">Contracts</Label>
          <Input
            id="contracts"
            type="number"
            min="1"
            value={contracts}
            onChange={(e) => setContracts(e.target.value)}
          />
        </div>
      </div>

      {optionData && (
        <div className="space-y-4">
          {/* Stock Info */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div>
              <h3 className="text-2xl font-bold">{optionData.symbol}</h3>
              <p className="text-sm text-muted-foreground">Cash-Secured Put Options</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">${optionData.underlyingPrice.toFixed(2)}</div>
              <p className="text-sm text-muted-foreground">Current Price</p>
            </div>
          </div>

          {/* Expiration Tabs */}
          <Tabs value={selectedExpiration} onValueChange={setSelectedExpiration}>
            <ScrollArea className="w-full whitespace-nowrap">
              <TabsList className="inline-flex w-auto">
                {optionData.expirations.map((exp) => (
                  <TabsTrigger key={exp} value={exp} className="px-4">
                    {formatExpiration(exp)}
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({getDaysToExpiration(exp)}d)
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>

            {optionData.expirations.map((exp) => (
              <TabsContent key={exp} value={exp} className="mt-4">
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-center">Strike</TableHead>
                        <TableHead className="text-center">Last</TableHead>
                        <TableHead className="text-center">Bid</TableHead>
                        <TableHead className="text-center">Ask</TableHead>
                        <TableHead className="text-center">Mid</TableHead>
                        <TableHead className="text-center">Volume</TableHead>
                        <TableHead className="text-center">OI</TableHead>
                        <TableHead className="text-center">IV</TableHead>
                        <TableHead className="text-center">ROC</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {optionData.puts
                        .filter(put => put.strike <= optionData.underlyingPrice * 1.1)
                        .sort((a, b) => b.strike - a.strike)
                        .slice(0, 25)
                        .map((option, idx) => {
                          const mid = (option.bid + option.ask) / 2;
                          const roc = calculateROC(option.strike, mid);
                          const pctFromCurrent = ((optionData.underlyingPrice - option.strike) / optionData.underlyingPrice * 100);
                          const isATM = pctFromCurrent < 5;
                          const isITM = option.inTheMoney;
                          
                          return (
                            <TableRow key={idx} className="hover:bg-muted/30">
                              <TableCell className="font-bold text-center">
                                ${option.strike.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-center">
                                ${option.lastPrice.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-center text-success">
                                ${option.bid.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-center text-destructive">
                                ${option.ask.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-center font-medium">
                                ${mid.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-center">
                                {option.volume.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-center">
                                {option.openInterest.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-center">
                                {(option.impliedVolatility * 100).toFixed(1)}%
                              </TableCell>
                              <TableCell className="text-center font-medium text-success">
                                {roc}%
                              </TableCell>
                              <TableCell className="text-center">
                                {isITM ? (
                                  <Badge variant="destructive" className="gap-1">
                                    <TrendingDown className="h-3 w-3" />
                                    ITM
                                  </Badge>
                                ) : isATM ? (
                                  <Badge variant="outline" className="border-warning text-warning gap-1">
                                    <TrendingUp className="h-3 w-3" />
                                    ATM
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="border-success text-success gap-1">
                                    <TrendingUp className="h-3 w-3" />
                                    OTM
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => handleAddToSimulator(option)}
                                  className="gap-1"
                                >
                                  <Plus className="h-3 w-3" />
                                  Add
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      )}

      {!optionData && (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Enter a stock symbol and click "Get Quotes" to view option prices</p>
        </div>
      )}
    </div>
  );
};
