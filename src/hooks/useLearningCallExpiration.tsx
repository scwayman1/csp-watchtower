import { useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface LearningCoveredCall {
  id: string;
  learning_assigned_position_id: string;
  strike_price: number;
  expiration: string;
  premium_per_contract: number;
  contracts: number;
  is_active: boolean;
}

interface LearningAssignedPosition {
  id: string;
  symbol: string;
  shares: number;
  assignment_price: number;
  is_active: boolean;
  covered_calls?: LearningCoveredCall[];
}

interface MarketData {
  symbol: string;
  underlying_price: number | null;
}

/**
 * Hook to automatically process expired covered calls in the Learning Center simulator.
 * 
 * When a covered call expires:
 * - OTM (price < strike): Call expires worthless, mark as inactive, shares remain
 * - ITM (price >= strike): Shares are "called away" at strike price
 */
export function useLearningCallExpiration(
  userId: string | undefined,
  assignedPositions: LearningAssignedPosition[]
) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const processedCallsRef = useRef<Set<string>>(new Set());

  const processExpiredCalls = useCallback(async () => {
    if (!userId || assignedPositions.length === 0) return;

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const todayStr = today.toISOString().split('T')[0];

    console.log('[LearningCallExpiration] Checking for expired calls...');

    // Get all unique symbols to fetch market data
    const symbols = [...new Set(assignedPositions.map(p => p.symbol))];
    
    const { data: marketData } = await supabase
      .from('market_data')
      .select('symbol, underlying_price')
      .in('symbol', symbols);

    const priceMap = new Map<string, number>(
      (marketData || []).map((m: MarketData) => [m.symbol, m.underlying_price || 0])
    );

    for (const position of assignedPositions) {
      if (!position.is_active || !position.covered_calls) continue;

      const currentPrice = priceMap.get(position.symbol) || 0;
      
      for (const call of position.covered_calls) {
        // Skip already processed or inactive calls
        if (!call.is_active || processedCallsRef.current.has(call.id)) continue;

        // Check if expired (expiration date is before or equal to today)
        const isExpired = call.expiration <= todayStr;
        
        if (!isExpired) continue;

        console.log(`[LearningCallExpiration] Processing expired call: ${position.symbol} $${call.strike_price} exp ${call.expiration}`);
        
        // Mark as processed to prevent duplicate processing
        processedCallsRef.current.add(call.id);

        const isITM = currentPrice >= call.strike_price;
        const sharesUnderCall = call.contracts * 100;

        if (isITM) {
          // Call is ITM - shares get called away at strike price
          console.log(`[LearningCallExpiration] Call ITM - calling away ${sharesUnderCall} shares at $${call.strike_price}`);
          
          // Calculate remaining shares after call away
          const remainingShares = position.shares - sharesUnderCall;
          
          if (remainingShares <= 0) {
            // All shares called away - close the position
            const { error: posError } = await supabase
              .from('learning_assigned_positions' as any)
              .update({
                is_active: false,
                sold_price: call.strike_price,
                closed_at: new Date().toISOString()
              })
              .eq('id', position.id);

            if (posError) {
              console.error('[LearningCallExpiration] Error closing position:', posError);
              continue;
            }

            toast({
              title: `${position.symbol} Called Away!`,
              description: `All ${position.shares} shares sold at $${call.strike_price.toFixed(2)} strike price.`,
            });
          } else {
            // Partial call away - update shares
            const { error: posError } = await supabase
              .from('learning_assigned_positions' as any)
              .update({
                shares: remainingShares,
                cost_basis: position.assignment_price * remainingShares
              })
              .eq('id', position.id);

            if (posError) {
              console.error('[LearningCallExpiration] Error updating position:', posError);
              continue;
            }

            toast({
              title: `${position.symbol} Partial Call Away`,
              description: `${sharesUnderCall} shares sold at $${call.strike_price.toFixed(2)}. ${remainingShares} shares remain.`,
            });
          }

          // Mark call as inactive
          await supabase
            .from('learning_covered_calls' as any)
            .update({
              is_active: false,
              closed_at: new Date().toISOString()
            })
            .eq('id', call.id);

        } else {
          // Call is OTM - expires worthless, premium kept, shares remain
          console.log(`[LearningCallExpiration] Call OTM - expired worthless, keeping ${sharesUnderCall} shares`);
          
          const { error: callError } = await supabase
            .from('learning_covered_calls' as any)
            .update({
              is_active: false,
              closed_at: new Date().toISOString()
            })
            .eq('id', call.id);

          if (callError) {
            console.error('[LearningCallExpiration] Error marking call inactive:', callError);
            continue;
          }

          toast({
            title: `${position.symbol} Call Expired Worthless`,
            description: `$${call.strike_price.toFixed(2)} call expired OTM. Premium kept, ${sharesUnderCall} shares now free to sell calls.`,
          });
        }
      }
    }

    // Invalidate queries to refresh UI
    queryClient.invalidateQueries({ queryKey: ['learning-assigned-positions', userId] });
  }, [userId, assignedPositions, toast, queryClient]);

  useEffect(() => {
    processExpiredCalls();
  }, [processExpiredCalls]);

  return { processExpiredCalls };
}
