import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Position } from "@/hooks/positions/types";
import { recordPositionOutcome } from "@/lib/aiOutcomeTracking";

export interface PendingPutAssignment {
  position: Position;
  assignmentPrice: number;
  shares: number;
  costBasis: number;
  isCurrentlyITM: boolean;
}

export function usePutAssignmentDetection(
  expiredPositions: Position[],
  assignedPositionIds: Set<string>,
  onAssigned: () => void
) {
  const processedPositionsRef = useRef<Set<string>>(new Set());
  const isProcessingRef = useRef(false);
  const initializedRef = useRef(false);

  // Seed in-memory ref from localStorage on first render so processed
  // positions persist across component remounts / page navigations
  if (!initializedRef.current) {
    initializedRef.current = true;
    try {
      const stored = localStorage.getItem('auto_processed_put_assignments');
      if (stored) {
        for (const id of JSON.parse(stored)) {
          processedPositionsRef.current.add(id);
        }
      }
    } catch { /* ignore */ }
  }

  const getProcessedPositions = useCallback((): Set<string> => {
    try {
      const stored = localStorage.getItem('auto_processed_put_assignments');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  }, []);

  const persistProcessed = useCallback((positionId: string) => {
    const processed = getProcessedPositions();
    processed.add(positionId);
    localStorage.setItem('auto_processed_put_assignments', JSON.stringify([...processed]));
  }, [getProcessedPositions]);

  const autoAssign = useCallback(async (position: Position) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const shares = position.contracts * 100;
      const assignmentPrice = position.strikePrice;
      const costBasis = assignmentPrice - (position.totalPremium / shares);

      const { error: assignError } = await supabase
        .from('assigned_positions')
        .insert({
          user_id: user.id,
          symbol: position.symbol,
          shares,
          assignment_date: position.expiration,
          assignment_price: assignmentPrice,
          original_put_premium: position.totalPremium,
          cost_basis: costBasis,
          original_position_id: position.id,
          is_active: true,
        });

      if (assignError) throw assignError;

      const { error: closeError } = await supabase
        .from('positions')
        .update({ is_active: false, closed_at: position.expiration })
        .eq('id', position.id);

      if (closeError) throw closeError;

      // Record AI recommendation outcome (best-effort)
      const assignmentLoss = Math.max(0, position.strikePrice - position.underlyingPrice) * shares;
      await recordPositionOutcome({
        positionId: position.id,
        actualPnL: position.totalPremium - assignmentLoss,
        wasAssigned: true,
        closedAt: position.expiration,
      });

      toast({
        title: "Position Auto-Assigned",
        description: (
          <div className="space-y-1">
            <p><strong>{position.symbol}</strong> - {shares} shares assigned at ${assignmentPrice.toFixed(2)} (ITM at expiration)</p>
            <p className="text-muted-foreground">Cost basis: ${costBasis.toFixed(2)}/share</p>
          </div>
        ),
        duration: 8000,
      });

      onAssigned();
    } catch (error: any) {
      console.error('Error auto-assigning position:', error);
      toast({
        title: "Error processing assignment",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [onAssigned]);

  const autoExpire = useCallback(async (position: Position) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Just mark as closed/inactive - expired worthless
      await supabase
        .from('positions')
        .update({ is_active: false, closed_at: position.expiration })
        .eq('id', position.id);

      // Record AI recommendation outcome (best-effort)
      await recordPositionOutcome({
        positionId: position.id,
        actualPnL: position.totalPremium,
        wasAssigned: false,
        closedAt: position.expiration,
      });

      toast({
        title: "Put Expired Worthless",
        description: (
          <div>
            <strong>{position.symbol}</strong> ${position.strikePrice.toFixed(2)} put expired OTM — premium kept: +${position.totalPremium.toFixed(2)}
          </div>
        ),
        duration: 5000,
      });
    } catch (error: any) {
      console.error('Error expiring position:', error);
    }
  }, []);

  const processExpiredPositions = useCallback(async () => {
    // Prevent concurrent executions from rapid effect re-fires
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    try {
      for (const position of expiredPositions) {
        // Read localStorage fresh each iteration to catch concurrent writes
        const persisted = getProcessedPositions();

        if (
          assignedPositionIds.has(position.id) ||
          processedPositionsRef.current.has(position.id) ||
          persisted.has(position.id)
        ) {
          continue;
        }

        processedPositionsRef.current.add(position.id);
        persistProcessed(position.id);

        const isITM = position.underlyingPrice < position.strikePrice;

        if (isITM) {
          await autoAssign(position);
        } else {
          await autoExpire(position);
        }
      }
    } finally {
      isProcessingRef.current = false;
    }
  }, [expiredPositions, assignedPositionIds, getProcessedPositions, persistProcessed, autoAssign, autoExpire]);

  useEffect(() => {
    if (expiredPositions.length > 0) {
      processExpiredPositions();
    }
  }, [expiredPositions, processExpiredPositions]);

  // Return empty array for backwards compat - no more pending assignments
  return {
    pendingAssignments: [] as PendingPutAssignment[],
    confirmAssignment: () => {},
    dismissAssignment: () => {},
    checkForAssignments: processExpiredPositions,
  };
}
