import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface AssignedPosition {
  id: string;
  symbol: string;
  shares: number;
  assignment_price: number;
  cost_basis: number;
  current_price?: number;
  unrealized_pnl?: number;
  original_put_premium: number;
  total_call_premiums?: number;
}

interface AssignedCapitalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignedPositions: AssignedPosition[];
  totalAssignedCapital: number;
}

export function AssignedCapitalDialog({
  open,
  onOpenChange,
  assignedPositions,
  totalAssignedCapital,
}: AssignedCapitalDialogProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assigned Capital Breakdown</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Total Assigned Capital</p>
              <p className="text-2xl font-bold">{formatCurrency(totalAssignedCapital)}</p>
            </div>
            <Badge variant="default" className="text-sm">
              {assignedPositions.length} Position{assignedPositions.length !== 1 ? 's' : ''}
            </Badge>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead className="text-right">Shares</TableHead>
                <TableHead className="text-right">Cost Basis</TableHead>
                <TableHead className="text-right">Capital Allocated</TableHead>
                <TableHead className="text-right">Current Value</TableHead>
                <TableHead className="text-right">Unrealized P/L</TableHead>
                <TableHead className="text-right">% of Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignedPositions.map((position) => {
                const capitalAllocated = position.cost_basis * position.shares;
                const currentValue = (position.current_price || position.assignment_price) * position.shares;
                const unrealizedPnL = position.unrealized_pnl || 0;
                const percentOfTotal = (capitalAllocated / totalAssignedCapital) * 100;
                const pnlPercent = (unrealizedPnL / capitalAllocated) * 100;

                return (
                  <TableRow key={position.id}>
                    <TableCell className="font-medium">{position.symbol}</TableCell>
                    <TableCell className="text-right">{position.shares.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{formatCurrency(position.cost_basis)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(capitalAllocated)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(currentValue)}</TableCell>
                    <TableCell className="text-right">
                      <span className={unrealizedPnL >= 0 ? "text-success" : "text-destructive"}>
                        {formatCurrency(unrealizedPnL)}
                        <span className="text-xs ml-1">({formatPercent(pnlPercent)})</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {percentOfTotal.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg text-sm">
            <div>
              <p className="text-muted-foreground">Total Shares</p>
              <p className="text-lg font-semibold">
                {assignedPositions.reduce((sum, p) => sum + p.shares, 0).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Total Premiums (Puts + Calls)</p>
              <p className="text-lg font-semibold">
                {formatCurrency(
                  assignedPositions.reduce((sum, p) => 
                    sum + p.original_put_premium + (p.total_call_premiums || 0), 0
                  )
                )}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Total Unrealized P/L</p>
              <p className={`text-lg font-semibold ${
                assignedPositions.reduce((sum, p) => sum + (p.unrealized_pnl || 0), 0) >= 0 
                  ? "text-success" 
                  : "text-destructive"
              }`}>
                {formatCurrency(
                  assignedPositions.reduce((sum, p) => sum + (p.unrealized_pnl || 0), 0)
                )}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
