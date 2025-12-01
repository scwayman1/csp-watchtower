import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PremiumAnalysisDialog } from "./PremiumAnalysisDialog";
import { AssignPositionDialog } from "./AssignPositionDialog";
import { MatrixTableRow } from "./MatrixTableRow";
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

  return (
    <AnalysisCacheContext.Provider value={{ cache: analysisCache, setCache: updateCache }}>
      <ScrollArea className="w-full">
        <div className="overflow-x-auto">
          <Table className="min-w-[1200px]">
            <TableHeader>
              <TableRow className="border-b border-border hover:bg-transparent">
                <TableHead className="w-[100px]">Ticker</TableHead>
                <TableHead className="w-[100px]">Underlying</TableHead>
                <TableHead className="w-[80px]">Trend</TableHead>
                <TableHead className="w-[90px]">Strike</TableHead>
                <TableHead className="w-[100px]">Premium</TableHead>
                <TableHead className="w-[60px]">DTE</TableHead>
                <TableHead className="w-[80px]">Risk</TableHead>
                <TableHead className="w-[100px]">P/L Open</TableHead>
                <TableHead className="w-[120px]">Manage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.map((position) => (
                <MatrixTableRow
                  key={position.id}
                  position={position}
                  onAnalyze={handleAnalyze}
                  onAssign={handleAssign}
                  formatCurrency={formatCurrency}
                  formatPercent={formatPercent}
                  getPremiumColorClass={getPremiumColorClass}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </ScrollArea>

      {selectedPosition && (
        <>
          <PremiumAnalysisDialog
            open={analysisOpen}
            onOpenChange={setAnalysisOpen}
            position={selectedPosition}
          />

          <AssignPositionDialog
            open={assignOpen}
            onOpenChange={setAssignOpen}
            position={selectedPosition}
            onSuccess={handleAssignSuccess}
          />
        </>
      )}
    </AnalysisCacheContext.Provider>
  );
}

export const useAnalysisCache = () => useContext(AnalysisCacheContext);
