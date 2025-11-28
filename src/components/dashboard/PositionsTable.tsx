import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Info, TrendingUp, TrendingDown, Sparkles, CheckCircle } from "lucide-react";
import { TrendSparkline } from "./TrendSparkline";
import { PremiumAnalysisDialog } from "./PremiumAnalysisDialog";
import { AssignPositionDialog } from "./AssignPositionDialog";
import { useState, createContext, useContext } from "react";

interface AnalysisCache {
  [positionId: string]: {
    qualityRating: 'excellent' | 'good' | 'fair' | 'poor';
    timestamp: number;
  };
}

const AnalysisCacheContext = createContext<{
  cache: AnalysisCache;
  setCache: (id: string, rating: 'excellent' | 'good' | 'fair' | 'poor') => void;
}>({
  cache: {},
  setCache: () => {},
});

export interface Position {
  id: string;
  symbol: string;
  underlyingName: string;
  strikePrice: number;
  underlyingPrice: number;
  expiration: string;
  contracts: number;
  premiumPerContract: number;
  totalPremium: number;
  contractValue: number;
  unrealizedPnL: number;
  daysToExp: number;
  pctAboveStrike: number;
  probAssignment: number;
  statusBand: "success" | "warning" | "destructive";
  dayChangePct?: number;
  intradayPrices?: number[];
}

interface PositionsTableProps {
  positions: Position[];
  onRefetch?: () => void;
  onRefetchAssigned?: () => void;
}

export function PositionsTable({ positions, onRefetch, onRefetchAssigned }: PositionsTableProps) {
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [analysisCache, setAnalysisCache] = useState<AnalysisCache>({});

  const updateCache = (id: string, rating: 'excellent' | 'good' | 'fair' | 'poor') => {
    setAnalysisCache(prev => ({
      ...prev,
      [id]: { qualityRating: rating, timestamp: Date.now() }
    }));
  };

  const getPremiumColorClass = (positionId: string) => {
    const cached = analysisCache[positionId];
    if (!cached) return '';
    
    switch (cached.qualityRating) {
      case 'excellent':
      case 'good':
        return 'text-success font-semibold';
      case 'fair':
        return 'text-warning font-semibold';
      case 'poor':
        return 'text-destructive font-semibold';
      default:
        return '';
    }
  };

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  const formatPercent = (value: number) => 
    `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

  const handleAnalyze = (position: Position) => {
    setSelectedPosition(position);
    setAnalysisOpen(true);
  };

  const handleAssign = (position: Position) => {
    setSelectedPosition(position);
    setAssignOpen(true);
  };

  const handleAssignSuccess = async () => {
    // Refetch both active positions and assigned positions
    const promises = [];
    if (onRefetch) promises.push(onRefetch());
    if (onRefetchAssigned) promises.push(onRefetchAssigned());
    await Promise.all(promises);
  };

  const getBadgeVariant = (band: string): "success" | "warning" | "destructive" | "default" => {
    if (band === "success") return "success";
    if (band === "warning") return "warning";
    if (band === "destructive") return "destructive";
    return "default";
  };

  const getProbabilityExplanation = (position: Position) => {
    const priceDiff = position.underlyingPrice - position.strikePrice;
    const pctDiff = position.pctAboveStrike;
    
    if (pctDiff >= 10) {
      return `Low probability (${position.probAssignment.toFixed(1)}%) because the underlying price ($${position.underlyingPrice.toFixed(2)}) is ${pctDiff.toFixed(1)}% above the strike ($${position.strikePrice.toFixed(2)}), with ${position.daysToExp} days remaining. The stock would need to drop significantly for assignment.`;
    } else if (pctDiff >= 5) {
      return `Moderate probability (${position.probAssignment.toFixed(1)}%) as the underlying price ($${position.underlyingPrice.toFixed(2)}) is ${pctDiff.toFixed(1)}% above strike ($${position.strikePrice.toFixed(2)}), with ${position.daysToExp} days to expiration. Assignment is possible if the stock declines.`;
    } else {
      return `Higher probability (${position.probAssignment.toFixed(1)}%) because the underlying price ($${position.underlyingPrice.toFixed(2)}) is only ${pctDiff.toFixed(1)}% above strike ($${position.strikePrice.toFixed(2)}), with ${position.daysToExp} days remaining. Close to the money - assignment risk is elevated.`;
    }
  };

  return (
    <AnalysisCacheContext.Provider value={{ cache: analysisCache, setCache: updateCache }}>
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-[1100px]">
          <TableHeader>
            <TableRow>
              <TableHead>Symbol</TableHead>
              <TableHead>Daily Trend</TableHead>
              <TableHead>Strike</TableHead>
              <TableHead>Underlying</TableHead>
              <TableHead>% Above</TableHead>
              <TableHead>Prem/ct</TableHead>
              <TableHead>Total Prem</TableHead>
              <TableHead>Contract Value</TableHead>
              <TableHead>Unrealized P/L</TableHead>
              <TableHead>Exp</TableHead>
              <TableHead>DTE</TableHead>
              <TableHead>Prob Assign</TableHead>
              <TableHead>AI Analysis</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
        <TableBody>
          {positions.map((position) => (
            <TableRow key={position.id} className="hover:bg-muted/50">
              <TableCell className="font-medium">
                <a
                  href={`https://finance.yahoo.com/quote/${position.symbol}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block hover:opacity-70 transition-opacity"
                >
                  <div className="font-semibold underline">{position.symbol}</div>
                  <div className="text-xs text-muted-foreground">{position.underlyingName}</div>
                </a>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  {position.dayChangePct !== undefined && position.dayChangePct !== null ? (
                    <a
                      href={`https://finance.yahoo.com/quote/${position.symbol}/news`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 hover:opacity-70 transition-opacity"
                    >
                      {position.dayChangePct >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-success" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-destructive" />
                      )}
                      <span className={position.dayChangePct >= 0 ? "text-success text-xs font-semibold underline" : "text-destructive text-xs font-semibold underline"}>
                        {formatPercent(position.dayChangePct)}
                      </span>
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
              </TableCell>
              <TableCell>{formatCurrency(position.strikePrice)}</TableCell>
              <TableCell>{formatCurrency(position.underlyingPrice)}</TableCell>
              <TableCell>
                <Badge variant={getBadgeVariant(position.statusBand)}>
                  {formatPercent(position.pctAboveStrike)}
                </Badge>
              </TableCell>
              <TableCell className={getPremiumColorClass(position.id)}>
                {formatCurrency(position.premiumPerContract)}
              </TableCell>
              <TableCell className="font-semibold">{formatCurrency(position.totalPremium)}</TableCell>
              <TableCell>{formatCurrency(position.contractValue)}</TableCell>
              <TableCell className={position.unrealizedPnL >= 0 ? "text-success" : "text-destructive"}>
                {formatCurrency(position.unrealizedPnL)}
              </TableCell>
              <TableCell className="text-sm">{position.expiration}</TableCell>
              <TableCell>
                <span className={position.daysToExp <= 7 ? "text-warning font-semibold" : ""}>
                  {position.daysToExp}
                </span>
              </TableCell>
              <TableCell>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 cursor-help">
                        <span>{position.probAssignment.toFixed(1)}%</span>
                        <Info className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-sm">{getProbabilityExplanation(position)}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableCell>
              <TableCell>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAnalyze(position)}
                  className="gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Analyze
                </Button>
              </TableCell>
              <TableCell>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => handleAssign(position)}
                  className="gap-1.5"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  Assign
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
        </div>
      </div>

      {selectedPosition && (
        <>
          <PremiumAnalysisDialog
            position={selectedPosition}
            open={analysisOpen}
            onOpenChange={setAnalysisOpen}
          />
          <AssignPositionDialog
            position={{
              id: selectedPosition.id,
              symbol: selectedPosition.symbol,
              strikePrice: selectedPosition.strikePrice,
              contracts: selectedPosition.contracts,
              totalPremium: selectedPosition.totalPremium,
              expiration: selectedPosition.expiration,
              underlyingPrice: selectedPosition.underlyingPrice,
              pctAboveStrike: selectedPosition.pctAboveStrike,
            }}
            open={assignOpen}
            onOpenChange={setAssignOpen}
            onSuccess={handleAssignSuccess}
          />
        </>
      )}
    </AnalysisCacheContext.Provider>
  );
}

export const useAnalysisCache = () => useContext(AnalysisCacheContext);
