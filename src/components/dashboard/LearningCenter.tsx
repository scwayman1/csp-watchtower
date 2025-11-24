import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OptionsChain } from "./OptionsChain";
import { EducationPanel } from "./EducationPanel";
import { SimulatorTable } from "./SimulatorTable";
import { GraduationCap, Search, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLearningPositions } from "@/hooks/useLearningPositions";
import { useOptionsChain } from "@/hooks/useOptionsChain";
import { format, differenceInDays, parseISO } from "date-fns";

export const LearningCenter = () => {
  const { user } = useAuth();
  const { positions, addPosition, closePosition, deletePosition } = useLearningPositions(user?.id);
  const [inputSymbol, setInputSymbol] = useState("ACVA");
  const [searchSymbol, setSearchSymbol] = useState("ACVA");
  const [contracts, setContracts] = useState(1);
  const [selectedExpiration, setSelectedExpiration] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: chainData, isLoading, refetch, isStale, staleReason } = useOptionsChain(searchSymbol);

  const handleSearch = () => {
    if (inputSymbol.trim()) {
      setSearchSymbol(inputSymbol.trim());
      setSelectedExpiration(null); // Reset expiration selection when searching new symbol
    }
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

  // Auto-select first expiration when data loads
  const currentExpiration = selectedExpiration || chainData?.expirations?.[0] || null;
  const currentOptions = currentExpiration && chainData?.options?.[currentExpiration] 
    ? chainData.options[currentExpiration] 
    : [];

  const getDaysToExpiration = (exp: string) => {
    try {
      // Convert Unix timestamp (seconds) to Date
      const date = new Date(parseInt(exp) * 1000);
      return differenceInDays(date, new Date());
    } catch {
      return 0;
    }
  };

  const formatExpirationLabel = (exp: string) => {
    try {
      // Convert Unix timestamp (seconds) to Date
      const date = new Date(parseInt(exp) * 1000);
      const dte = getDaysToExpiration(exp);
      return `${format(date, 'MMM dd')} (${dte}d)`;
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
          Practice pricing cash-secured puts with live market data and simulate trades without risk
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
                  <label className="text-sm font-medium mb-2 block">Stock Symbol</label>
                  <Input
                    placeholder="e.g., AAPL"
                    value={inputSymbol}
                    onChange={(e) => setInputSymbol(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
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
                      onAddToSimulator={handleAddPosition}
                      symbol={searchSymbol}
                      isStale={isStale}
                    />
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Enter a symbol and click "Get Quotes" to view the options chain</p>
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