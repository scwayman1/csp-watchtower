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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all active positions to find symbols we need prices for
    const { data: positions, error: positionsError } = await supabase
      .from('positions')
      .select('symbol')
      .eq('is_active', true);

    if (positionsError) throw positionsError;

    const symbols = [...new Set(positions?.map(p => p.symbol) || [])];
    
    if (symbols.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active positions to update' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const POLYGON_API_KEY = Deno.env.get('POLYGON_API_KEY');
    
    if (!POLYGON_API_KEY) {
      throw new Error('POLYGON_API_KEY not configured');
    }

    // Fetch prices from Polygon.io
    const priceUpdates = await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const response = await fetch(
            `https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?adjusted=true&apiKey=${POLYGON_API_KEY}`
          );
          
          if (!response.ok) {
            console.error(`Failed to fetch ${symbol}:`, response.status);
            return null;
          }
          
          const data = await response.json();
          
          if (data.results && data.results[0]) {
            return {
              symbol,
              underlying_price: data.results[0].c, // Close price
              last_updated: new Date().toISOString(),
            };
          }
          
          return null;
        } catch (error) {
          console.error(`Error fetching ${symbol}:`, error);
          return null;
        }
      })
    );

    const validUpdates = priceUpdates.filter(u => u !== null);

    if (validUpdates.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No price data available' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upsert market data
    const { error: upsertError } = await supabase
      .from('market_data')
      .upsert(validUpdates, { onConflict: 'symbol' });

    if (upsertError) throw upsertError;

    return new Response(
      JSON.stringify({ 
        message: 'Market data updated successfully',
        updated: validUpdates.length,
        symbols: validUpdates.map(u => u.symbol)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error refreshing market data:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
