import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, CheckCircle } from "lucide-react";
import { LearningPosition } from "@/hooks/useLearningPositions";
import { usePositions } from "@/hooks/usePositions";

interface SimulatorTableProps {
  positions: LearningPosition[];
  onClose: (id: string) => void;
  onDelete: (id: string) => void;
}

export const SimulatorTable = ({ positions, onClose, onDelete }: SimulatorTableProps) => {
  const { positions: realPositions } = usePositions();

  // Calculate metrics for each position
  const enhancedPositions = useMemo(() => {
    return positions.map(pos => {
      // Find real market data if available
      const marketData = realPositions.find(rp => rp.symbol === pos.symbol);
      const underlyingPrice = marketData?.underlyingPrice || 0;
      const currentMarkPrice = marketData?.markPrice || pos.premium_per_contract;

      // Calculate metrics
      const cashSecured = pos.strike_price * 100 * pos.contracts;
      const totalPremium = pos.premium_per_contract * 100 * pos.contracts;
      const currentValue = currentMarkPrice * 100 * pos.contracts;
      const unrealizedPnL = totalPremium - currentValue;
      const roc = ((totalPremium / cashSecured) * 100);
      
      const daysToExp = Math.ceil((new Date(pos.expiration).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      const pctAboveStrike = underlyingPrice > 0 ? ((underlyingPrice - pos.strike_price) / pos.strike_price * 100) : 0;

      return {
        ...pos,
        underlyingPrice,
        cashSecured,
        totalPremium,
        unrealizedPnL,
        roc,
        daysToExp,
        pctAboveStrike,
        currentValue,
      };
    });
  }, [positions, realPositions]);

  const totalCashSecured = enhancedPositions.reduce((sum, p) => sum + p.cashSecured, 0);
  const totalPremium = enhancedPositions.reduce((sum, p) => sum + p.totalPremium, 0);
  const totalUnrealizedPnL = enhancedPositions.reduce((sum, p) => sum + p.unrealizedPnL, 0);

  if (positions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No practice positions yet.</p>
        <p className="text-sm mt-2">Use the Option Pricer to add positions to your simulator.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-muted/50 p-4 rounded-lg">
          <p className="text-sm text-muted-foreground">Total Cash Secured</p>
          <p className="text-2xl font-bold">${totalCashSecured.toLocaleString('en-US', { minimumFractionDigits: 0 })}</p>
        </div>
        <div className="bg-muted/50 p-4 rounded-lg">
          <p className="text-sm text-muted-foreground">Total Premium</p>
          <p className="text-2xl font-bold">${totalPremium.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-muted/50 p-4 rounded-lg">
          <p className="text-sm text-muted-foreground">Unrealized P/L</p>
          <p className={`text-2xl font-bold ${totalUnrealizedPnL >= 0 ? 'text-success' : 'text-destructive'}`}>
            ${totalUnrealizedPnL.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Symbol</TableHead>
              <TableHead>Strike</TableHead>
              <TableHead>Expiration</TableHead>
              <TableHead>Contracts</TableHead>
              <TableHead>Premium</TableHead>
              <TableHead>ROC</TableHead>
              <TableHead>% Above</TableHead>
              <TableHead>Unrealized P/L</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {enhancedPositions.map((pos) => (
              <TableRow key={pos.id}>
                <TableCell className="font-medium">{pos.symbol}</TableCell>
                <TableCell>${pos.strike_price}</TableCell>
                <TableCell>
                  {pos.expiration}
                  <span className="text-xs text-muted-foreground ml-2">
                    ({pos.daysToExp}d)
                  </span>
                </TableCell>
                <TableCell>{pos.contracts}</TableCell>
                <TableCell>${pos.premium_per_contract.toFixed(2)}</TableCell>
                <TableCell>{pos.roc.toFixed(2)}%</TableCell>
                <TableCell>
                  {pos.underlyingPrice > 0 ? (
                    <Badge 
                      variant={
                        pos.pctAboveStrike >= 10 ? "outline" :
                        pos.pctAboveStrike >= 5 ? "secondary" :
                        "destructive"
                      }
                      className={
                        pos.pctAboveStrike >= 10 ? "border-success text-success" :
                        pos.pctAboveStrike >= 5 ? "border-warning text-warning" :
                        ""
                      }
                    >
                      {pos.pctAboveStrike.toFixed(1)}%
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className={pos.unrealizedPnL >= 0 ? 'text-success' : 'text-destructive'}>
                    ${pos.unrealizedPnL.toFixed(2)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onClose(pos.id)}
                    >
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDelete(pos.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};