import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Info, Filter, Star, TrendingUp, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

type SortColumn = 'roc' | 'delta' | 'premium' | 'strike' | null;
type SortDirection = 'asc' | 'desc';

interface OptionRow {
  strike: number;
  bid: number;
  ask: number;
  mid: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  delta?: number;
  inTheMoney: boolean;
  lastPrice: number;
}

interface OptionsChainProps {
  underlyingPrice: number;
  options: OptionRow[];
  contracts: number;
  expiration: string;
  onAddToSimulator?: (row: any) => void;
  symbol: string;
  isStale?: boolean;
  optionType?: 'PUT' | 'CALL';
}

type StrikeRangeOption = '5' | '10' | '15' | '20' | '30' | 'all';
type DeltaRangeOption = 'all' | '0.10-0.20' | '0.20-0.30' | '0.30-0.40' | '0.40-0.50' | '0.10-0.30' | '0.20-0.40';

interface FilterPreset {
  id: string;
  label: string;
  description: string;
  strikeRange: StrikeRangeOption;
  deltaRange: DeltaRangeOption;
}

const FILTER_PRESETS: FilterPreset[] = [
  { id: 'conservative', label: 'Conservative OTM', description: '±20% strike, Δ 0.20-0.30', strikeRange: '20', deltaRange: '0.20-0.30' },
  { id: 'safe', label: 'Safe & Far OTM', description: '±30% strike, Δ 0.10-0.20', strikeRange: '30', deltaRange: '0.10-0.20' },
  { id: 'balanced', label: 'Balanced', description: '±15% strike, Δ 0.30-0.40', strikeRange: '15', deltaRange: '0.30-0.40' },
  { id: 'aggressive', label: 'Aggressive', description: '±10% strike, Δ 0.40-0.50', strikeRange: '10', deltaRange: '0.40-0.50' },
  { id: 'sweetspot', label: 'Sweet Spot', description: '±20% strike, Δ 0.20-0.40', strikeRange: '20', deltaRange: '0.20-0.40' },
];

const STRIKE_RANGE_OPTIONS: { value: StrikeRangeOption; label: string }[] = [
  { value: '5', label: '±5% from current' },
  { value: '10', label: '±10% from current' },
  { value: '15', label: '±15% from current' },
  { value: '20', label: '±20% from current' },
  { value: '30', label: '±30% from current' },
  { value: 'all', label: 'Show all strikes' },
];

const DELTA_RANGE_OPTIONS: { value: DeltaRangeOption; label: string; description: string }[] = [
  { value: 'all', label: 'All deltas', description: 'Show all options' },
  { value: '0.10-0.20', label: 'Δ 0.10-0.20', description: 'Low probability (~10-20%)' },
  { value: '0.20-0.30', label: 'Δ 0.20-0.30', description: 'Conservative (~20-30%)' },
  { value: '0.30-0.40', label: 'Δ 0.30-0.40', description: 'Balanced (~30-40%)' },
  { value: '0.40-0.50', label: 'Δ 0.40-0.50', description: 'Aggressive (~40-50%)' },
  { value: '0.10-0.30', label: 'Δ 0.10-0.30', description: 'Safe range (~10-30%)' },
  { value: '0.20-0.40', label: 'Δ 0.20-0.40', description: 'Sweet spot (~20-40%)' },
];

export const OptionsChain = ({ 
  underlyingPrice, 
  options, 
  contracts, 
  expiration,
  onAddToSimulator,
  symbol,
  isStale = false,
  optionType = 'PUT'
}: OptionsChainProps) => {
  const [strikeRange, setStrikeRange] = useState<StrikeRangeOption>('20');
  const [deltaRange, setDeltaRange] = useState<DeltaRangeOption>('all');
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else {
        setSortColumn(null);
        setSortDirection('desc');
      }
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    return sortDirection === 'desc' 
      ? <ArrowDown className="h-3 w-3 ml-1" />
      : <ArrowUp className="h-3 w-3 ml-1" />;
  };

  const applyPreset = (preset: FilterPreset) => {
    setStrikeRange(preset.strikeRange);
    setDeltaRange(preset.deltaRange);
    setActivePreset(preset.id);
  };

  const clearPreset = () => {
    setActivePreset(null);
  };
  
  const calculateMetrics = (option: OptionRow) => {
    // Safely handle undefined values with defaults
    const credit = option.mid ?? 0;
    const strike = option.strike ?? 0;
    const breakeven = optionType === 'PUT' ? strike - credit : strike + credit;
    const totalPremium = credit * 100 * contracts;
    const capitalReq = strike * 100 * contracts;
    const maxProfit = totalPremium;
    const roc = capitalReq > 0 ? (maxProfit / capitalReq) * 100 : 0;
    const pctFromSpot = underlyingPrice > 0 ? ((strike - underlyingPrice) / underlyingPrice) * 100 : 0;
    const probAssign = Math.abs(option.delta ?? 0);
    
    let status = 'Safe';
    let statusVariant: 'default' | 'secondary' | 'destructive' = 'default';
    
    if (optionType === 'PUT') {
      // For cash-secured puts: negative pctFromSpot = OTM = Safe
      if (pctFromSpot <= -10) {
        status = 'Safe';
        statusVariant = 'default';
      } else if (pctFromSpot <= -5) {
        status = 'Moderate';
        statusVariant = 'secondary';
      } else {
        status = 'Risky';
        statusVariant = 'destructive';
      }
    } else {
      // For covered calls: positive pctFromSpot = OTM = Safe
      if (pctFromSpot >= 10) {
        status = 'Safe';
        statusVariant = 'default';
      } else if (pctFromSpot >= 5) {
        status = 'Moderate';
        statusVariant = 'secondary';
      } else {
        status = 'Risky';
        statusVariant = 'destructive';
      }
    }
    
    return {
      credit,
      breakeven,
      totalPremium,
      capitalReq,
      maxProfit,
      roc,
      pctFromSpot,
      probAssign,
      status,
      statusVariant
    };
  };

  // Filter options based on strike range and delta range
  const filteredOptions = useMemo(() => {
    let result = options;
    
    // Apply strike range filter
    if (strikeRange !== 'all') {
      const rangePercent = parseInt(strikeRange) / 100;
      const minStrike = underlyingPrice * (1 - rangePercent);
      const maxStrike = underlyingPrice * (1 + rangePercent);
      result = result.filter(opt => opt.strike >= minStrike && opt.strike <= maxStrike);
    }
    
    // Apply delta range filter
    if (deltaRange !== 'all') {
      const [minDelta, maxDelta] = deltaRange.split('-').map(parseFloat);
      result = result.filter(opt => {
        const absDelta = Math.abs(opt.delta ?? 0);
        return absDelta >= minDelta && absDelta <= maxDelta;
      });
    }
    
    return result;
  }, [options, underlyingPrice, strikeRange, deltaRange]);

  const enhancedOptions = useMemo(() => 
    filteredOptions.map(opt => ({
      ...opt,
      ...calculateMetrics(opt)
    })),
    [filteredOptions, underlyingPrice, contracts]
  );

  // Calculate "Best Value" score for each option
  // High ROC + Low Delta = Best Value (balance of return vs risk)
  const optionsWithScore = useMemo(() => {
    if (enhancedOptions.length === 0) return [];
    
    // Normalize ROC and delta for scoring
    const maxRoc = Math.max(...enhancedOptions.map(o => o.roc));
    const minRoc = Math.min(...enhancedOptions.map(o => o.roc));
    const rocRange = maxRoc - minRoc || 1;
    
    return enhancedOptions.map(opt => {
      const absDelta = Math.abs(opt.delta ?? 0.5);
      // ROC score: higher is better (0-1 scale)
      const rocScore = (opt.roc - minRoc) / rocRange;
      // Delta score: lower delta is better for safety (invert so lower delta = higher score)
      const deltaScore = 1 - absDelta;
      // Combined score: weight ROC at 60%, safety at 40%
      const valueScore = (rocScore * 0.6) + (deltaScore * 0.4);
      
      return {
        ...opt,
        valueScore,
        rocScore,
        deltaScore
      };
    });
  }, [enhancedOptions]);

  // Sort options based on selected column
  const sortedOptions = useMemo(() => {
    if (!sortColumn) return optionsWithScore;
    
    return [...optionsWithScore].sort((a, b) => {
      let aVal = 0, bVal = 0;
      
      switch (sortColumn) {
        case 'roc':
          aVal = a.roc;
          bVal = b.roc;
          break;
        case 'delta':
          aVal = Math.abs(a.delta ?? 0);
          bVal = Math.abs(b.delta ?? 0);
          break;
        case 'premium':
          aVal = a.mid;
          bVal = b.mid;
          break;
        case 'strike':
          aVal = a.strike;
          bVal = b.strike;
          break;
      }
      
      return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }, [optionsWithScore, sortColumn, sortDirection]);

  // Find top 3 best value options (based on unsorted for consistent ranking)
  const bestValueStrikes = useMemo(() => {
    if (optionsWithScore.length === 0) return new Set<number>();
    
    const sorted = [...optionsWithScore]
      .sort((a, b) => b.valueScore - a.valueScore)
      .slice(0, 3);
    
    return new Set(sorted.map(s => s.strike));
  }, [optionsWithScore]);

  if (options.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No {optionType === 'PUT' ? 'puts' : 'calls'} available for this expiration.
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Quick Filter Presets */}
        <div className="flex flex-wrap items-center gap-2 px-1">
          <span className="text-sm font-medium text-muted-foreground mr-1">Quick:</span>
          {FILTER_PRESETS.map(preset => (
            <Tooltip key={preset.id}>
              <TooltipTrigger asChild>
                <Button
                  variant={activePreset === preset.id ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => applyPreset(preset)}
                >
                  {preset.label}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{preset.description}</p>
              </TooltipContent>
            </Tooltip>
          ))}
          {activePreset && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={clearPreset}
            >
              Clear
            </Button>
          )}
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-4 px-1">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Strike:</span>
            <Select value={strikeRange} onValueChange={(v) => { setStrikeRange(v as StrikeRangeOption); clearPreset(); }}>
              <SelectTrigger className="w-[160px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STRIKE_RANGE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Delta:</span>
            <Select value={deltaRange} onValueChange={(v) => { setDeltaRange(v as DeltaRangeOption); clearPreset(); }}>
              <SelectTrigger className="w-[160px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DELTA_RANGE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex flex-col">
                      <span>{opt.label}</span>
                      <span className="text-xs text-muted-foreground">{opt.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <span className="text-xs text-muted-foreground ml-auto">
            Showing {optionsWithScore.length} of {options.length} strikes
          </span>
        </div>

        {optionsWithScore.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No strikes within selected range. Try expanding the filter.
          </div>
        ) : (
        <div className="rounded-md border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-center">
                        <Star className="h-3.5 w-3.5 text-amber-500" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      Best value based on ROC vs assignment risk
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-right">
                  <button 
                    onClick={() => handleSort('strike')}
                    className="flex items-center justify-end gap-1 hover:text-foreground transition-colors w-full"
                  >
                    Strike
                    <SortIcon column="strike" />
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    % From Current
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3" />
                      </TooltipTrigger>
                      <TooltipContent>
                        (Strike - Spot) / Spot × 100%
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableHead>
                <TableHead className="text-right">
                  <button 
                    onClick={() => handleSort('premium')}
                    className="flex items-center justify-end gap-1 hover:text-foreground transition-colors w-full"
                  >
                    Bid/Ask/Mid
                    <SortIcon column="premium" />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3" />
                      </TooltipTrigger>
                      <TooltipContent>
                        NBBO quotes; Mid = (Bid + Ask) / 2. Click to sort by Mid.
                      </TooltipContent>
                    </Tooltip>
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    Break-Even
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Strike - Credit
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableHead>
                <TableHead className="text-right">Total Premium</TableHead>
                <TableHead className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    Capital Req.
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Strike × 100 × Contracts (cash secured)
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableHead>
                <TableHead className="text-right">Max Profit</TableHead>
                <TableHead className="text-right">
                  <button 
                    onClick={() => handleSort('roc')}
                    className="flex items-center justify-end gap-1 hover:text-foreground transition-colors w-full"
                  >
                    ROC %
                    <SortIcon column="roc" />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Max Profit / Capital Required. Click to sort.
                      </TooltipContent>
                    </Tooltip>
                  </button>
                </TableHead>
                <TableHead className="text-right">Vol/OI</TableHead>
                <TableHead className="text-right">IV</TableHead>
                <TableHead className="text-right">
                  <button 
                    onClick={() => handleSort('delta')}
                    className="flex items-center justify-end gap-1 hover:text-foreground transition-colors w-full"
                  >
                    Δ
                    <SortIcon column="delta" />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Delta (assignment probability proxy). Click to sort.
                      </TooltipContent>
                    </Tooltip>
                  </button>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedOptions.map((option, idx) => {
                const isBestValue = bestValueStrikes.has(option.strike);
                const topPick = [...optionsWithScore].sort((a, b) => b.valueScore - a.valueScore)[0];
                const isTopPick = topPick && option.strike === topPick.strike;
                return (
                  <TableRow 
                    key={idx}
                    className={`
                      ${isBestValue 
                        ? "bg-amber-500/10 hover:bg-amber-500/15 ring-1 ring-inset ring-amber-500/30" 
                        : option.pctFromSpot >= 10 
                          ? "bg-success/5 hover:bg-success/10" 
                          : option.pctFromSpot >= 5 
                          ? "bg-warning/5 hover:bg-warning/10"
                          : "bg-destructive/5 hover:bg-destructive/10"
                      }
                    `}
                  >
                    <TableCell className="text-center">
                      {isBestValue && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className={`flex items-center justify-center gap-0.5 ${isTopPick ? 'text-amber-500' : 'text-amber-400/70'}`}>
                              {isTopPick ? (
                                <>
                                  <Star className="h-4 w-4 fill-amber-500" />
                                  <TrendingUp className="h-3 w-3" />
                                </>
                              ) : (
                                <Star className="h-4 w-4" />
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[200px]">
                            <div className="space-y-1">
                              <p className="font-medium">{isTopPick ? '🏆 Top Pick' : '⭐ Best Value'}</p>
                              <p className="text-xs text-muted-foreground">
                                Score: {(option.valueScore * 100).toFixed(0)}%
                              </p>
                              <p className="text-xs">
                                ROC {option.roc.toFixed(1)}% with {(Math.abs(option.delta ?? 0) * 100).toFixed(0)}% assignment risk
                              </p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${(option.strike ?? 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                    <span className={
                      option.pctFromSpot >= 10 
                        ? "text-success" 
                        : option.pctFromSpot >= 5 
                        ? "text-warning"
                        : "text-destructive"
                    }>
                      {option.pctFromSpot >= 0 ? '+' : ''}{(option.pctFromSpot ?? 0).toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    <span className={isStale ? "text-muted-foreground" : ""}>
                      ${(option.bid ?? 0).toFixed(2)} / ${(option.ask ?? 0).toFixed(2)} / ${(option.mid ?? 0).toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    ${(option.breakeven ?? 0).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ${(option.totalPremium ?? 0).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    ${(option.capitalReq ?? 0).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-success">
                    ${(option.maxProfit ?? 0).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {(option.roc ?? 0).toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {option.volume ?? 0}/{option.openInterest ?? 0}
                  </TableCell>
                  <TableCell className="text-right">
                    {((option.impliedVolatility ?? 0) * 100).toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right">
                    {option.delta !== undefined && option.delta !== null ? option.delta.toFixed(2) : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={option.statusVariant}>
                      {option.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {onAddToSimulator ? (
                      <Button
                        size="sm"
                        onClick={() => onAddToSimulator({
                          symbol,
                          strike_price: option.strike,
                          expiration,
                          contracts,
                          premium_per_contract: option.mid,
                          notes: `ROC: ${option.roc.toFixed(2)}%, Δ: ${option.delta?.toFixed(2) || 'N/A'}`
                        })}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">View only</span>
                    )}
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
    </TooltipProvider>
  );
};
