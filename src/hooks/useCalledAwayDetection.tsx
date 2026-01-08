import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { AssignedPosition, CoveredCall } from "@/hooks/assigned/types";

export interface PendingCalledAway {
  position: AssignedPosition;
  coveredCall: CoveredCall;
  realizedGain: number;
}

export function useCalledAwayDetection(
  assignedPositions: AssignedPosition[],
  onCalledAway: () => void
) {
  const processedCallsRef = useRef<Set<string>>(new Set());
  const dismissedCallsRef = useRef<Set<string>>(new Set());
  const [pendingEvents, setPendingEvents] = useState<PendingCalledAway[]>([]);

  const confirmCalledAway = useCallback(async (event: PendingCalledAway) => {
    const { position, coveredCall, realizedGain } = event;
    
    try {
      // Calculate shares being called away (covered call contracts × 100)
      const sharesCalledAway = coveredCall.contracts * 100;
      const remainingShares = position.shares - sharesCalledAway;

      // Mark the covered call as closed
      await supabase
        .from('covered_calls')
        .update({
          is_active: false,
          closed_at: new Date().toISOString()
        })
        .eq('id', coveredCall.id);

      if (remainingShares <= 0) {
        // All shares called away - close the assigned position
        await supabase
          .from('assigned_positions')
          .update({
            is_active: false,
            sold_price: coveredCall.strike_price,
            closed_at: new Date().toISOString()
          })
          .eq('id', position.id);

        toast({
          title: "📞 Shares Called Away!",
          description: (
            <div className="space-y-1">
              <p><strong>{position.symbol}</strong> - {position.shares} shares sold at ${coveredCall.strike_price.toFixed(2)}</p>
              <p className="text-success font-semibold">
                Realized Gain: ${realizedGain.toFixed(2)}
              </p>
            </div>
          ),
          duration: 10000,
        });
      } else {
        // Partial call - update remaining shares
        await supabase
          .from('assigned_positions')
          .update({
            shares: remainingShares
          })
          .eq('id', position.id);

        toast({
          title: "📞 Partial Call Away",
          description: (
            <div className="space-y-1">
              <p><strong>{position.symbol}</strong> - {sharesCalledAway} shares sold at ${coveredCall.strike_price.toFixed(2)}</p>
              <p>{remainingShares} shares remaining</p>
              <p className="text-success font-semibold">
                Realized Gain: ${realizedGain.toFixed(2)}
              </p>
            </div>
          ),
          duration: 10000,
        });
      }

      // Remove from pending and trigger refetch
      setPendingEvents(prev => prev.filter(e => e.coveredCall.id !== coveredCall.id));
      onCalledAway();
    } catch (error: any) {
      console.error('Error processing called away:', error);
      toast({
        title: "Error processing assignment",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [onCalledAway]);

  const dismissEvent = useCallback((callId: string) => {
    dismissedCallsRef.current.add(callId);
    setPendingEvents(prev => prev.filter(e => e.coveredCall.id !== callId));
  }, []);

  const checkForCalledAway = useCallback(async () => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    const newPendingEvents: PendingCalledAway[] = [];
    
    for (const position of assignedPositions) {
      if (!position.covered_calls?.length) continue;
      
      const currentPrice = position.current_price || 0;
      
      for (const call of position.covered_calls) {
        // Skip if already processed, dismissed, not active, or already closed
        if (
          !call.is_active || 
          call.closed_at || 
          processedCallsRef.current.has(call.id) ||
          dismissedCallsRef.current.has(call.id)
        ) {
          continue;
        }
        
        const expirationStr = call.expiration;
        const isExpiredOrExpiringToday = expirationStr <= todayStr;
        const isITM = currentPrice >= call.strike_price;
        
        if (isExpiredOrExpiringToday && isITM) {
          processedCallsRef.current.add(call.id);
          
          const sharesCalledAway = call.contracts * 100;
          const callPremium = call.premium_per_contract * 100 * call.contracts;
          const capitalGain = (call.strike_price - position.cost_basis) * sharesCalledAway;
          const realizedGain = capitalGain + callPremium;
          
          newPendingEvents.push({
            position,
            coveredCall: call,
            realizedGain
          });
        }
      }
    }

    if (newPendingEvents.length > 0) {
      setPendingEvents(prev => [...prev, ...newPendingEvents]);
    }
  }, [assignedPositions]);

  useEffect(() => {
    if (assignedPositions.length > 0) {
      checkForCalledAway();
    }
  }, [assignedPositions, checkForCalledAway]);

  return { 
    pendingEvents, 
    confirmCalledAway, 
    dismissEvent,
    checkForCalledAway 
  };
}
