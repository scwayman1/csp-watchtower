import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

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
}

interface PositionsTableProps {
  positions: Position[];
}

export function PositionsTable({ positions }: PositionsTableProps) {
  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  const formatPercent = (value: number) => 
    `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

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
    <div className="rounded-2xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Symbol</TableHead>
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
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.map((position) => (
            <TableRow key={position.id} className="hover:bg-muted/50">
              <TableCell className="font-medium">
                <div>
                  <div className="font-semibold">{position.symbol}</div>
                  <div className="text-xs text-muted-foreground">{position.underlyingName}</div>
                </div>
              </TableCell>
              <TableCell>{formatCurrency(position.strikePrice)}</TableCell>
              <TableCell>{formatCurrency(position.underlyingPrice)}</TableCell>
              <TableCell>
                <Badge variant={getBadgeVariant(position.statusBand)}>
                  {formatPercent(position.pctAboveStrike)}
                </Badge>
              </TableCell>
              <TableCell>{formatCurrency(position.premiumPerContract)}</TableCell>
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
