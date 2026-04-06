import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PhoneCall, TrendingUp, PartyPopper } from "lucide-react";
import type { AssignedPosition } from "@/hooks/useAssignedPositions";

interface CalledAwayPositionsProps {
  positions: AssignedPosition[];
}

export function CalledAwayPositions({ positions }: CalledAwayPositionsProps) {
  if (positions.length === 0) return null;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const totalRealizedGain = positions.reduce((sum, p) => sum + (p.realized_pnl || 0), 0);
  const totalPremiums = positions.reduce((sum, p) => 
    sum + p.original_put_premium + (p.total_call_premiums || 0), 0
  );

  return (
    <Card className="border-success/30 bg-gradient-to-br from-success/5 to-background">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5 text-success" />
            <CardTitle className="text-lg">Called Away Positions</CardTitle>
            <Badge variant="outline" className="text-success border-success">
              {positions.length} completed
            </Badge>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total Premiums</p>
              <p className="font-semibold text-success">+{formatCurrency(totalPremiums)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total Realized Gain</p>
              <p className={`font-bold text-lg ${totalRealizedGain >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(totalRealizedGain)}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="overflow-x-auto border border-border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Shares</TableHead>
                <TableHead>Assigned Date</TableHead>
                <TableHead>Cost Basis</TableHead>
                <TableHead>Sold Price</TableHead>
                <TableHead>Closed Date</TableHead>
                <TableHead>Put Premium</TableHead>
                <TableHead>Call Premiums</TableHead>
                <TableHead>Capital Gain</TableHead>
                <TableHead>Total Realized P/L</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.map((position) => {
                const capitalGain = ((position.sold_price || 0) - position.cost_basis) * position.shares;
                
                return (
                  <TableRow key={position.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{position.symbol}</span>
                        <PartyPopper className="h-4 w-4 text-success" />
                        {position.source === 'purchase' && (
                          <Badge variant="outline" className="text-xs">Sold</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{position.shares.toLocaleString()}</TableCell>
                    <TableCell className="text-sm">{formatDate(position.assignment_date)}</TableCell>
                    <TableCell>{formatCurrency(position.cost_basis)}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(position.sold_price || 0)}</TableCell>
                    <TableCell className="text-sm">{formatDate(position.closed_at)}</TableCell>
                    <TableCell className="text-success">+{formatCurrency(position.original_put_premium)}</TableCell>
                    <TableCell className="text-success">+{formatCurrency(position.total_call_premiums || 0)}</TableCell>
                    <TableCell className={capitalGain >= 0 ? 'text-success' : 'text-destructive'}>
                      {formatCurrency(capitalGain)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <TrendingUp className={`h-4 w-4 ${(position.realized_pnl || 0) >= 0 ? 'text-success' : 'text-destructive'}`} />
                        <span className={`font-bold ${(position.realized_pnl || 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {formatCurrency(position.realized_pnl || 0)}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground mt-3 italic">
          Completed positions. Includes wheel cycles (called away) and direct sales.
        </p>
      </CardContent>
    </Card>
  );
}
