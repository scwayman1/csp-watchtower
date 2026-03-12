import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Position } from "@/hooks/positions/types";

export interface PendingPutAssignment {
  position: Position;
  assignmentPrice: number;
  shares: number;
  costBasis: number;
  isCurrentlyITM: boolean;  // Whether current price is below strike (may have changed since expiration)
}

export function usePutAssignmentDetection(
  expiredPositions: Position[],
  assignedPositionIds: Set<string>,
  onAssigned: () => void
) {
  const processedPositionsRef = useRef<Set<string>>(new Set());
  const [pendingAssignments, setPendingAssignments] = useState<PendingPutAssignment[]>([]);

  const getDismissedPositions = useCallback((): Set<string> => {
    try {
      const stored = localStorage.getItem('dismissed_put_assignments');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  }, []);

  const persistDismissal = useCallback((positionId: string) => {
    const dismissed = getDismissedPositions();
    dismissed.add(positionId);
    localStorage.setItem('dismissed_put_assignments', JSON.stringify([...dismissed]));
  }, [getDismissedPositions]);

  const confirmAssignment = useCallback(async (event: PendingPutAssignment) => {
    const { position } = event;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const shares = position.contracts * 100;
      const assignmentPrice = position.strikePrice;
      const costBasis = assignmentPrice - (position.totalPremium / shares);

      // Create assigned position
      const { error: assignError } = await supabase
        .from('assigned_positions')
        .insert({
          user_id: user.id,
          symbol: position.symbol,
          shares: shares,
          assignment_date: position.expiration,
          assignment_price: assignmentPrice,
          original_put_premium: position.totalPremium,
          cost_basis: costBasis,
          original_position_id: position.id,
          is_active: true,
        });

      if (assignError) throw assignError;

      // Mark original position as inactive (closed)
      const { error: closeError } = await supabase
        .from('positions')
        .update({
          is_active: false,
          closed_at: position.expiration
        })
        .eq('id', position.id);

      if (closeError) throw closeError;

      toast({
        title: "Position Assigned",
        description: (
          <div className="space-y-1">
            <p><strong>{position.symbol}</strong> - {shares} shares assigned at ${assignmentPrice.toFixed(2)}</p>
            <p className="text-muted-foreground">
              Cost basis: ${costBasis.toFixed(2)}/share
            </p>
          </div>
        ),
        duration: 8000,
      });

      // Remove from pending and trigger refetch
      setPendingAssignments(prev => prev.filter(e => e.position.id !== position.id));
      onAssigned();
    } catch (error: any) {
      console.error('Error processing assignment:', error);
      toast({
        title: "Error processing assignment",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [onAssigned]);

  const dismissAssignment = useCallback((positionId: string) => {
    persistDismissal(positionId);
    setPendingAssignments(prev => prev.filter(e => e.position.id !== positionId));
  }, [persistDismissal]);

  const checkForAssignments = useCallback(() => {
    const newPendingAssignments: PendingPutAssignment[] = [];

    const dismissed = getDismissedPositions();

    for (const position of expiredPositions) {
      if (
        assignedPositionIds.has(position.id) ||
        processedPositionsRef.current.has(position.id) ||
        dismissed.has(position.id)
      ) {
        continue;
      }

      // Flag ALL expired positions for review - user confirms if assigned or not
      // The current price may have changed since expiration, so we can't rely on it
      processedPositionsRef.current.add(position.id);

      const shares = position.contracts * 100;
      const assignmentPrice = position.strikePrice;
      const costBasis = assignmentPrice - (position.totalPremium / shares);
      const isCurrentlyITM = position.underlyingPrice < position.strikePrice;

      newPendingAssignments.push({
        position,
        assignmentPrice,
        shares,
        costBasis,
        isCurrentlyITM,
      });
    }

    if (newPendingAssignments.length > 0) {
      setPendingAssignments(prev => [...prev, ...newPendingAssignments]);
    }
  }, [expiredPositions, assignedPositionIds]);

  useEffect(() => {
    if (expiredPositions.length > 0) {
      checkForAssignments();
    }
  }, [expiredPositions, checkForAssignments]);

  return {
    pendingAssignments,
    confirmAssignment,
    dismissAssignment,
    checkForAssignments
  };
}
