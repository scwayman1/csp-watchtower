import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { positionId } = await req.json();

    if (!positionId) {
      throw new Error("Position ID is required");
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error("Authorization header required");
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    console.log(`Tracking outcome for position: ${positionId}`);

    // Get the position details
    const { data: position, error: positionError } = await supabaseClient
      .from('positions')
      .select('*')
      .eq('id', positionId)
      .single();

    if (positionError || !position) {
      throw new Error("Position not found");
    }

    // Get the latest AI recommendation for this position
    const { data: recommendation, error: recError } = await supabaseClient
      .from('ai_recommendations')
      .select('*')
      .eq('position_id', positionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (recError || !recommendation) {
      console.log("No AI recommendation found for this position");
      return new Response(
        JSON.stringify({ message: "No recommendation to track" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate actual outcome
    const actualPnL = position.total_premium || 0; // Will be calculated from actual closing data
    const wasAssigned = !position.is_active && position.closed_at; // Simplified logic
    
    // Determine actual outcome
    let actualOutcome = "expired_otm";
    if (wasAssigned) {
      actualOutcome = actualPnL > 0 ? "assigned_profitable" : "assigned_loss";
    } else if (!position.is_active) {
      actualOutcome = actualPnL > 0 ? "closed_profitable" : "closed_loss";
    }

    // Calculate prediction accuracy
    let predictionAccuracy = 0.5; // Default
    if (recommendation.predicted_outcome && recommendation.quality_rating) {
      // Simple accuracy calculation based on quality rating match
      const qualityMap: Record<string, number> = { 
        'excellent': 0.9, 
        'fair': 0.6, 
        'poor': 0.3 
      };
      
      const expectedQuality = qualityMap[recommendation.quality_rating.toLowerCase()] || 0.5;
      const actualQuality = actualPnL > 0 ? 0.9 : 0.3;
      
      predictionAccuracy = 1 - Math.abs(expectedQuality - actualQuality);
    }

    // Store the outcome
    const { error: outcomeError } = await supabaseClient
      .from('ai_recommendation_outcomes')
      .insert({
        recommendation_id: recommendation.id,
        position_id: positionId,
        actual_outcome: actualOutcome,
        actual_pnl: actualPnL,
        was_assigned: wasAssigned,
        closed_at: position.closed_at || new Date().toISOString(),
        prediction_accuracy: predictionAccuracy
      });

    if (outcomeError) {
      throw outcomeError;
    }

    console.log("Outcome tracked successfully");

    return new Response(
      JSON.stringify({ 
        success: true,
        outcome: {
          actual_outcome: actualOutcome,
          actual_pnl: actualPnL,
          prediction_accuracy: predictionAccuracy
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error tracking outcome:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});