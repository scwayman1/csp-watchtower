import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { AssignedPosition } from "@/hooks/useAssignedPositions";
import { SellCallDialog } from "./SellCallDialog";
import { CoveredCallImportBar } from "./CoveredCallImportBar";

interface AssignedPositionsTableProps {
  positions: AssignedPosition[];
  onRefetch: () => void;
}

export function AssignedPositionsTable({ positions, onRefetch }: AssignedPositionsTableProps) {
  const [selectedPosition, setSelectedPosition] = useState<{ id: string; symbol: string } | null>(null);
  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  const formatDate = (dateString: string) => 
    new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="space-y-4">
      {/* Bulk Import Bar */}
      <CoveredCallImportBar onSuccess={onRefetch} />
      
      {/* Assigned Positions Table */}
      <div className="rounded-2xl border bg-card overflow-hidden">
      <div className="p-4 sm:p-6 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-semibold">Assigned Shares (Wheel Strategy)</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Track shares from assigned puts and covered call premiums
            </p>
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <Table className="min-w-[1000px]">
        <TableHeader>
          <TableRow>
            <TableHead>Symbol</TableHead>
            <TableHead>Shares</TableHead>
            <TableHead>Assigned</TableHead>
            <TableHead>Assignment $</TableHead>
            <TableHead>Cost Basis</TableHead>
            <TableHead>Current $</TableHead>
            <TableHead>Unrealized P/L</TableHead>
            <TableHead>Put Premium</TableHead>
            <TableHead>Call Premiums</TableHead>
            <TableHead>Net Position</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                No assigned positions yet. When your puts get assigned, they'll appear here.
              </TableCell>
            </TableRow>
          ) : (
            positions.map((position) => (
              <TableRow key={position.id} className="hover:bg-muted/50">
                <TableCell className="font-semibold">{position.symbol}</TableCell>
                <TableCell>{position.shares.toLocaleString()}</TableCell>
                <TableCell className="text-sm">{formatDate(position.assignment_date)}</TableCell>
                <TableCell>{formatCurrency(position.assignment_price)}</TableCell>
                <TableCell className="font-medium">{formatCurrency(position.cost_basis)}</TableCell>
                <TableCell>{formatCurrency(position.current_price || 0)}</TableCell>
                <TableCell className={position.unrealized_pnl && position.unrealized_pnl >= 0 ? "text-success font-semibold" : "text-destructive font-semibold"}>
                  {formatCurrency(position.unrealized_pnl || 0)}
                </TableCell>
                <TableCell className="text-success">
                  +{formatCurrency(position.original_put_premium)}
                </TableCell>
                <TableCell className="text-success">
                  {position.total_call_premiums && position.total_call_premiums > 0 ? (
                    <div>
                      <div className="font-semibold">+{formatCurrency(position.total_call_premiums)}</div>
                      {position.covered_calls && position.covered_calls.filter(c => c.is_active).length > 0 && (
                        <Badge variant="outline" className="mt-1 text-xs">
                          {position.covered_calls.filter(c => c.is_active).length} active call{position.covered_calls.filter(c => c.is_active).length > 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">$0.00</span>
                  )}
                </TableCell>
                <TableCell className={position.net_position && position.net_position >= 0 ? "text-success font-bold" : "text-destructive font-bold"}>
                  {formatCurrency(position.net_position || 0)}
                </TableCell>
                <TableCell>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="gap-1"
                    onClick={() => setSelectedPosition({ id: position.id, symbol: position.symbol })}
                  >
                    <Plus className="h-3 w-3" />
                    Sell Call
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      </div>

      <SellCallDialog
        open={!!selectedPosition}
        onOpenChange={(open) => !open && setSelectedPosition(null)}
        assignedPositionId={selectedPosition?.id || ""}
        symbol={selectedPosition?.symbol || ""}
        onSuccess={onRefetch}
      />
      </div>
    </div>
  );
}
