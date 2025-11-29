import { useMemo, useEffect, useState } from "react";
import { Position } from "./PositionsTable";
import { BatchRow } from "./BatchRow";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

interface HistoryExpiredBatchesProps {
  positions: Position[];
  onRefetch?: () => void;
  onRefetchAssigned?: () => void;
}

interface AssignedPositionData {
  id: string;
  symbol: string;
  shares: number;
  original_put_premium: number;
  original_position_id: string | null;
}

interface OriginalPositionData {
  id: string;
  expiration: string;
}

interface PositionWithOpenedAt extends Position {
  openedAt?: string;
}

export function HistoryExpiredBatches({ positions, onRefetch, onRefetchAssigned }: HistoryExpiredBatchesProps) {
  const [assignedPositions, setAssignedPositions] = useState<AssignedPositionData[]>([]);
  const [allPositions, setAllPositions] = useState<OriginalPositionData[]>([]);

  // Fetch all positions and assigned positions to match by expiration date
  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch all positions (including those that led to assignments)
      const { data: positionsData } = await supabase
        .from('positions')
        .select('id, expiration')
        .eq('user_id', user.id);

      if (positionsData) {
        setAllPositions(positionsData as OriginalPositionData[]);
      }

      // Fetch assigned positions
      const { data: assignedData } = await supabase
        .from('assigned_positions')
        .select('id, symbol, shares, original_put_premium, original_position_id')
        .eq('user_id', user.id);

      if (assignedData) {
        setAssignedPositions(assignedData as AssignedPositionData[]);
      }
    };

    fetchData();
  }, []);

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
      <h2 className="text-xl font-semibold mb-4">History (Expired Positions)</h2>
      <Card className="rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          {batches.map(([batchDate, batchPositions], index) => {
            // Find all original positions with this expiration date
            const originalPositionsWithExpiration = allPositions.filter(
              p => p.expiration === batchDate
            );
            const originalPositionIds = originalPositionsWithExpiration.map(p => p.id);
            
            // Find assigned positions that originated from positions with this expiration date
            const batchAssignedPositions = assignedPositions.filter(
              ap => ap.original_position_id && originalPositionIds.includes(ap.original_position_id)
            );

            return (
              <BatchRow
                key={batchDate}
                batchDate={batchDate}
                positions={batchPositions}
                assignedPositions={batchAssignedPositions}
                onRefetch={onRefetch}
                onRefetchAssigned={onRefetchAssigned}
                batchIndex={index}
              />
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
