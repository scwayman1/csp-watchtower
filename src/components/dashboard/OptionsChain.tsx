import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Info, Filter } from "lucide-react";

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

const STRIKE_RANGE_OPTIONS: { value: StrikeRangeOption; label: string }[] = [
  { value: '5', label: '±5% from current' },
  { value: '10', label: '±10% from current' },
  { value: '15', label: '±15% from current' },
  { value: '20', label: '±20% from current' },
  { value: '30', label: '±30% from current' },
  { value: 'all', label: 'Show all strikes' },
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

  // Filter options based on strike range
  const filteredOptions = useMemo(() => {
    if (strikeRange === 'all') return options;
    
    const rangePercent = parseInt(strikeRange) / 100;
    const minStrike = underlyingPrice * (1 - rangePercent);
    const maxStrike = underlyingPrice * (1 + rangePercent);
    
    return options.filter(opt => opt.strike >= minStrike && opt.strike <= maxStrike);
  }, [options, underlyingPrice, strikeRange]);

  const enhancedOptions = useMemo(() => 
    filteredOptions.map(opt => ({
      ...opt,
      ...calculateMetrics(opt)
    })),
    [filteredOptions, underlyingPrice, contracts]
  );

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
        {/* Strike Range Filter */}
        <div className="flex items-center gap-3 px-1">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Strike Range:</span>
          <Select value={strikeRange} onValueChange={(v) => setStrikeRange(v as StrikeRangeOption)}>
            <SelectTrigger className="w-[180px] h-8">
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
          <span className="text-xs text-muted-foreground">
            Showing {enhancedOptions.length} of {options.length} strikes
          </span>
        </div>

        {enhancedOptions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No strikes within selected range. Try expanding the filter.
          </div>
        ) : (
        <div className="rounded-md border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">Strike</TableHead>
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
                  <div className="flex items-center justify-end gap-1">
                    Bid/Ask/Mid
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3" />
                      </TooltipTrigger>
                      <TooltipContent>
                        NBBO quotes; Mid = (Bid + Ask) / 2
                      </TooltipContent>
                    </Tooltip>
                  </div>
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
                  <div className="flex items-center justify-end gap-1">
                    ROC %
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Max Profit / Capital Required
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableHead>
                <TableHead className="text-right">Vol/OI</TableHead>
                <TableHead className="text-right">IV</TableHead>
                <TableHead className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    Δ
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Delta (assignment probability proxy)
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enhancedOptions.map((option, idx) => (
                <TableRow 
                  key={idx}
                  className={
                    option.pctFromSpot >= 10 
                      ? "bg-success/5 hover:bg-success/10" 
                      : option.pctFromSpot >= 5 
                      ? "bg-warning/5 hover:bg-warning/10"
                      : "bg-destructive/5 hover:bg-destructive/10"
                  }
                >
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
              ))}
            </TableBody>
          </Table>
        </div>
        </div>
        )}
      </div>
    </TooltipProvider>
  );
};
