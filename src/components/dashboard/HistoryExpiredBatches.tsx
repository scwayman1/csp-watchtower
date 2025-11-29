import { useMemo } from "react";
import { Position } from "./PositionsTable";
import { BatchRow } from "./BatchRow";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CleanupExpiredButton } from "./CleanupExpiredButton";

interface HistoryExpiredBatchesProps {
  positions: Position[];
  onRefetch?: () => void;
  onRefetchAssigned?: () => void;
}

interface PositionWithOpenedAt extends Position {
  openedAt?: string;
}

export function HistoryExpiredBatches({ positions, onRefetch, onRefetchAssigned }: HistoryExpiredBatchesProps) {
  // Group positions by opened date (batch)
  const batches = useMemo(() => {
    const grouped = new Map<string, Position[]>();
    
    positions.forEach((position) => {
      // Use expiration as a proxy for batch date if opened_at is not available
      // In a real scenario, you'd use position.opened_at
      const batchDate = position.expiration;
      
      if (!grouped.has(batchDate)) {
        grouped.set(batchDate, []);
      }
      grouped.get(batchDate)!.push(position);
    });
    
    // Convert to array and sort by date (most recent first)
    return Array.from(grouped.entries())
      .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
  }, [positions]);

  if (positions.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">History (Expired Positions)</h2>
        <CleanupExpiredButton onSuccess={onRefetch} />
      </div>
      <Card className="rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          {batches.map(([batchDate, batchPositions]) => (
            <BatchRow
              key={batchDate}
              batchDate={batchDate}
              positions={batchPositions}
              onRefetch={onRefetch}
              onRefetchAssigned={onRefetchAssigned}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
