import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Info } from "lucide-react";

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
  onAddToSimulator: (row: any) => void;
  symbol: string;
  isStale?: boolean;
}

export const OptionsChain = ({ 
  underlyingPrice, 
  options, 
  contracts, 
  expiration,
  onAddToSimulator,
  symbol,
  isStale = false
}: OptionsChainProps) => {
  
  const calculateMetrics = (option: OptionRow) => {
    const credit = option.mid;
    const breakeven = option.strike - credit;
    const totalPremium = credit * 100 * contracts;
    const capitalReq = option.strike * 100 * contracts;
    const maxProfit = totalPremium;
    const roc = capitalReq > 0 ? (maxProfit / capitalReq) * 100 : 0;
    const pctFromSpot = ((option.strike - underlyingPrice) / underlyingPrice) * 100;
    const probAssign = Math.abs(option.delta || 0);
    
    let status = 'Safe';
    let statusVariant: 'default' | 'secondary' | 'destructive' = 'default';
    
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

  const enhancedOptions = useMemo(() => 
    options.map(opt => ({
      ...opt,
      ...calculateMetrics(opt)
    })),
    [options, underlyingPrice, contracts]
  );

  if (options.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No puts available for this expiration.
      </div>
    );
  }

  return (
    <TooltipProvider>
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
                    ${option.strike.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={
                      option.pctFromSpot >= 10 
                        ? "text-success" 
                        : option.pctFromSpot >= 5 
                        ? "text-warning"
                        : "text-destructive"
                    }>
                      {option.pctFromSpot >= 0 ? '+' : ''}{option.pctFromSpot.toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    <span className={isStale ? "text-muted-foreground" : ""}>
                      ${option.bid.toFixed(2)} / ${option.ask.toFixed(2)} / ${option.mid.toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    ${option.breakeven.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ${option.totalPremium.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    ${option.capitalReq.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-success">
                    ${option.maxProfit.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {option.roc.toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {option.volume}/{option.openInterest}
                  </TableCell>
                  <TableCell className="text-right">
                    {(option.impliedVolatility * 100).toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right">
                    {option.delta?.toFixed(2) || 'N/A'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={option.statusVariant}>
                      {option.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  );
};
