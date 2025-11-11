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

    // Fetch daily aggregate data from Polygon.io (free tier compatible)
    // Rate limit: 5 requests per minute, so delay 12 seconds between each call
    const priceUpdates = [];
    
    for (const symbol of symbols) {
      try {
        // Get yesterday's data for daily open and previous close
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().split('T')[0];
        
        // Fetch daily aggregate (open, close, high, low) - single API call
        const aggregateResponse = await fetch(
          `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${dateStr}/${dateStr}?adjusted=true&apiKey=${POLYGON_API_KEY}`
        );
        
        if (!aggregateResponse.ok) {
          console.error(`Failed to fetch data for ${symbol}:`, aggregateResponse.status);
          await new Promise(resolve => setTimeout(resolve, 12000));
          continue;
        }
        
        const aggregateData = await aggregateResponse.json();
        
        if (aggregateData.results && aggregateData.results.length > 0) {
          const dayData = aggregateData.results[0];
          const previousClose = dayData.c; // Previous day close
          const currentOpen = dayData.o; // Yesterday's open (best we can get with free tier)
          
          // Use yesterday's close as current price approximation for free tier
          const currentPrice = previousClose;
          const dayChangePct = ((currentPrice - currentOpen) / currentOpen) * 100;
          
          priceUpdates.push({
            symbol,
            underlying_price: currentPrice,
            day_open: currentOpen,
            day_change_pct: dayChangePct,
            intraday_prices: null, // Not available in free tier
            last_updated: new Date().toISOString(),
          });
        }
        
        // Wait 12 seconds before next request (5 per minute = 1 every 12 seconds)
        await new Promise(resolve => setTimeout(resolve, 12000));
      } catch (error) {
        console.error(`Error fetching ${symbol}:`, error);
        await new Promise(resolve => setTimeout(resolve, 12000));
      }
    }

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
