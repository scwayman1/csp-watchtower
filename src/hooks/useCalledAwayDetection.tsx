import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { AssignedPosition } from "@/hooks/useAssignedPositions";

interface CalledAwayEvent {
  position: AssignedPosition;
  coveredCall: {
    id: string;
    strike_price: number;
    expiration: string;
    premium_per_contract: number;
    contracts: number;
  };
  realizedGain: number;
}

export function useCalledAwayDetection(
  assignedPositions: AssignedPosition[],
  onCalledAway: () => void
) {
  const processedCallsRef = useRef<Set<string>>(new Set());

  const processCalledAway = useCallback(async (event: CalledAwayEvent) => {
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

        // Show success notification
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

      // Trigger refetch
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

  const checkForCalledAway = useCallback(async () => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    console.log('[CalledAwayDetection] Checking positions:', assignedPositions.length);
    
    for (const position of assignedPositions) {
      if (!position.covered_calls?.length) continue;
      
      const currentPrice = position.current_price || 0;
      console.log(`[CalledAwayDetection] ${position.symbol}: price=${currentPrice}, calls=${position.covered_calls.length}`);
      
      for (const call of position.covered_calls) {
        // Skip if already processed or not active
        if (!call.is_active || processedCallsRef.current.has(call.id)) {
          console.log(`[CalledAwayDetection] Skipping call ${call.id}: is_active=${call.is_active}, processed=${processedCallsRef.current.has(call.id)}`);
          continue;
        }
        
        // Check if expiration date is today or in the past
        const expirationStr = call.expiration; // YYYY-MM-DD format
        const isExpiredOrExpiringToday = expirationStr <= todayStr;
        const isITM = currentPrice >= call.strike_price;
        
        console.log(`[CalledAwayDetection] Call ${call.id}: expiration=${expirationStr}, today=${todayStr}, expired=${isExpiredOrExpiringToday}, strike=${call.strike_price}, ITM=${isITM}`);
        
        if (isExpiredOrExpiringToday && isITM) {
          console.log(`[CalledAwayDetection] TRIGGERING called away for ${position.symbol}!`);
          // Mark as processed to prevent duplicate processing
          processedCallsRef.current.add(call.id);
          
          // Calculate realized gain
          const sharesCalledAway = call.contracts * 100;
          const callPremium = call.premium_per_contract * 100 * call.contracts;
          const capitalGain = (call.strike_price - position.cost_basis) * sharesCalledAway;
          const putPremiumPortion = (position.original_put_premium / position.shares) * sharesCalledAway;
          const realizedGain = capitalGain + callPremium + putPremiumPortion;
          
          await processCalledAway({
            position,
            coveredCall: call,
            realizedGain
          });
        }
      }
    }
  }, [assignedPositions, processCalledAway]);

  useEffect(() => {
    // Check on mount and whenever positions change
    if (assignedPositions.length > 0) {
      checkForCalledAway();
    }
  }, [assignedPositions, checkForCalledAway]);

  return { checkForCalledAway };
}
