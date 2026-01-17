import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OptionsChain } from "./OptionsChain";
import { EducationPanel } from "./EducationPanel";
import { SimulatorTable } from "./SimulatorTable";
import { GraduationCap, Search, RefreshCw, AlertCircle, DollarSign } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLearningPositions } from "@/hooks/useLearningPositions";
import { useOptionsChain } from "@/hooks/useOptionsChain";
import { useTickerSearch } from "@/hooks/useTickerSearch";
import { useSimulatorCapital } from "@/hooks/useSimulatorCapital";
import { format, differenceInDays, parseISO } from "date-fns";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

// Ticker symbol validation schema
const tickerSchema = z.string()
  .trim()
  .min(1, "Ticker symbol is required")
  .max(5, "Ticker symbol must be 5 characters or less")
  .regex(/^[A-Z]+$/, "Ticker must contain only uppercase letters (e.g., AAPL, MSFT)");

export const LearningCenter = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { positions, addPosition, closePosition, deletePosition } = useLearningPositions(user?.id);
  const { availableCapital, isLoading: capitalLoading } = useSimulatorCapital(user?.id);
  const [inputSymbol, setInputSymbol] = useState("");
  const [searchSymbol, setSearchSymbol] = useState("");
  const [contracts, setContracts] = useState(1);
  const [selectedExpiration, setSelectedExpiration] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [optionType, setOptionType] = useState<'PUT' | 'CALL'>('PUT');

  const { data: chainData, isLoading, refetch, isStale, staleReason } = useOptionsChain(searchSymbol, optionType);
  const { data: searchResults, isLoading: isSearching } = useTickerSearch(searchQuery);

  const handleSearch = () => {
    const trimmedSymbol = inputSymbol.trim().toUpperCase();
    
    // Validate ticker symbol
    const validation = tickerSchema.safeParse(trimmedSymbol);
    
    if (!validation.success) {
      const errorMessage = validation.error.errors[0]?.message || "Invalid ticker symbol";
      setValidationError(errorMessage);
      toast({
        title: "Invalid Ticker Symbol",
        description: errorMessage,
        variant: "destructive",
      });
      return;
    }
    
    // Clear any previous errors and search
    setValidationError(null);
    setSearchSymbol(trimmedSymbol);
    setSelectedExpiration(null); // Reset expiration selection when searching new symbol
  };

  const handleInputChange = (value: string) => {
    const upperValue = value.toUpperCase();
    setInputSymbol(upperValue);
    setSearchQuery(value);
    
    // Clear validation error when user types
    if (validationError) {
      setValidationError(null);
    }
  };

  const handleSelectTicker = (symbol: string, description: string) => {
    setInputSymbol(symbol);
    setSearchQuery("");
    setIsSearchOpen(false);
    toast({
      title: "Company Selected",
      description: `${symbol} - ${description}`,
    });
  };

  const handleRefresh = () => {
    refetch();
  };

  const handleAddPosition = (position: any) => {
    // Convert Unix timestamp to ISO date string for database
    const expirationDate = new Date(parseInt(position.expiration) * 1000).toISOString().split('T')[0];
    addPosition({
      ...position,
      expiration: expirationDate
    });
    setRefreshKey(prev => prev + 1);
  };

  const handleCapitalExceeded = (requiredCapital: number, currentAvailable: number) => {
    toast({
      title: "Insufficient Capital",
      description: `This position requires $${requiredCapital.toLocaleString()} but you only have $${currentAvailable.toLocaleString()} available. Close some positions or adjust your starting capital.`,
      variant: "destructive",
    });
  };

  // Auto-select first expiration when data loads
  const currentExpiration = selectedExpiration || chainData?.expirations?.[0] || null;
  const currentOptions = currentExpiration && chainData?.options?.[currentExpiration] 
    ? chainData.options[currentExpiration] 
    : [];

  const unixExpToISODate = (exp: string) => {
    // exp is unix seconds at 00:00 UTC; convert to YYYY-MM-DD
    return new Date(parseInt(exp) * 1000).toISOString().split("T")[0];
  };

  const isoDateToLocalDate = (isoDate: string) => {
    // Parse as local date to avoid timezone shifting the day
    const [year, month, day] = isoDate.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const getDaysToExpiration = (exp: string) => {
    try {
      const localDate = isoDateToLocalDate(unixExpToISODate(exp));
      return differenceInDays(localDate, new Date());
    } catch {
      return 0;
    }
  };

  const formatExpirationLabel = (exp: string) => {
    try {
      const localDate = isoDateToLocalDate(unixExpToISODate(exp));
      const dte = getDaysToExpiration(exp);
      return `${format(localDate, 'MMM dd')} (${dte}d)`;
    } catch {
      return exp;
    }
  };

  return (
    <Card className="mt-6 overflow-visible">
      <CardHeader>
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" />
          <CardTitle>Learning Center</CardTitle>
        </div>
        <CardDescription>
          Practice pricing {optionType === 'PUT' ? 'cash-secured puts' : 'covered calls'} with live market data and simulate trades without risk
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-visible">
        <Tabs defaultValue="chain" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="chain">Options Chain</TabsTrigger>
            <TabsTrigger value="simulator">
              My Simulator ({positions.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="chain" className="mt-4">
            <div className="space-y-4">
              {/* Symbol Search Bar */}
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-sm font-medium mb-2 block">Stock Symbol or Company Name</label>
                  <div className="space-y-1 relative">
                    <Input
                      placeholder="e.g., AAPL, Apple, Microsoft"
                      value={inputSymbol}
                      onChange={(e) => handleInputChange(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      onFocus={() => setIsSearchOpen(true)}
                      onBlur={() => setTimeout(() => setIsSearchOpen(false), 200)}
                      className={validationError ? "border-destructive" : ""}
                      maxLength={50}
                    />
                    {isSearchOpen && searchQuery.length >= 2 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md z-50 max-h-[300px] overflow-auto">
                        {isSearching && (
                          <div className="p-4 text-sm text-muted-foreground">Searching...</div>
                        )}
                        {!isSearching && searchResults && searchResults.length === 0 && (
                          <div className="p-4 text-sm text-muted-foreground">No stocks found.</div>
                        )}
                        {!isSearching && searchResults && searchResults.length > 0 && (
                          <div className="p-2">
                            <div className="text-xs font-semibold text-muted-foreground px-2 py-1">Stocks</div>
                            {searchResults.map((result) => (
                              <button
                                key={result.symbol}
                                onClick={() => handleSelectTicker(result.symbol, result.description)}
                                className="w-full text-left px-2 py-2 hover:bg-accent rounded-sm transition-colors"
                              >
                                <div className="flex flex-col">
                                  <span className="font-semibold text-sm">{result.symbol}</span>
                                  <span className="text-xs text-muted-foreground">{result.description}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {validationError && (
                      <div className="flex items-center gap-1 text-xs text-destructive">
                        <AlertCircle className="h-3 w-3" />
                        <span>{validationError}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-none">
                  <label className="text-sm font-medium mb-2 block">Contracts</label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={contracts}
                      onChange={(e) => setContracts(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20"
                    />
                    <div className="flex gap-1">
                      {[1, 5, 10].map(qty => (
                        <Button
                          key={qty}
                          size="sm"
                          variant={contracts === qty ? "default" : "outline"}
                          onClick={() => setContracts(qty)}
                          className="h-8 px-2 text-xs"
                        >
                          {qty}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex-none">
                  <label className="text-sm font-medium mb-2 block">Option Type</label>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant={optionType === 'PUT' ? "default" : "outline"}
                      onClick={() => setOptionType('PUT')}
                      className="h-8 px-3 text-xs"
                    >
                      Cash-Secured Put
                    </Button>
                    <Button
                      size="sm"
                      variant={optionType === 'CALL' ? "default" : "outline"}
                      onClick={() => setOptionType('CALL')}
                      className="h-8 px-3 text-xs"
                    >
                      Covered Call
                    </Button>
                  </div>
                </div>
                <Button onClick={handleSearch} disabled={isLoading}>
                  {isLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4 mr-2" />
                  )}
                  Get Quotes
                </Button>
                {chainData && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleRefresh} 
                    disabled={isLoading}
                    title="Refresh quotes manually (cached for 5 minutes)"
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  </Button>
                )}
                {chainData && (
                  <>
                    <Badge variant="outline">
                      {searchSymbol}: ${chainData.underlyingPrice.toFixed(2)}
                    </Badge>
                    {isStale && (
                      <Badge variant="secondary">
                        Data from cache
                      </Badge>
                    )}
                  </>
                )}
                {optionType === 'PUT' && !capitalLoading && (
                  <Badge 
                    variant={availableCapital < 10000 ? "destructive" : availableCapital < 50000 ? "secondary" : "outline"}
                    className="flex items-center gap-1"
                  >
                    <DollarSign className="h-3 w-3" />
                    Available: ${availableCapital.toLocaleString()}
                  </Badge>
                )}
              </div>

              {/* Expiration Tabs */}
              {chainData && chainData.expirations.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {chainData.expirations.map((exp) => (
                    <Button
                      key={exp}
                      variant={currentExpiration === exp ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedExpiration(exp)}
                    >
                      {formatExpirationLabel(exp)}
                    </Button>
                  ))}
                </div>
              )}

              {/* Main Content: Chain + Education */}
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
                <div>
                  {chainData && currentExpiration ? (
                    <OptionsChain
                      underlyingPrice={chainData.underlyingPrice}
                      options={currentOptions}
                      contracts={contracts}
                      expiration={currentExpiration}
                      onAddToSimulator={optionType === 'PUT' ? handleAddPosition : undefined}
                      symbol={searchSymbol}
                      isStale={isStale}
                      optionType={optionType}
                      availableCapital={optionType === 'PUT' ? availableCapital : undefined}
                      onCapitalExceeded={handleCapitalExceeded}
                    />
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Enter a symbol and click "Get Quotes" to view {optionType === 'PUT' ? 'put' : 'call'} options</p>
                    </div>
                  )}
                </div>

                {/* Education Panel */}
                <div className="hidden lg:block">
                  <EducationPanel />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="simulator" className="mt-4">
            <SimulatorTable 
              positions={positions} 
              onClose={closePosition}
              onDelete={deletePosition}
              userId={user?.id}
              key={refreshKey}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};