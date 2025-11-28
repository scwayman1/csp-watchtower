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

    // Fetch prices from Yahoo Finance API (free, no API key needed)
    const priceUpdates = [];
    
    for (const symbol of symbols) {
      try {
        // Add delay between requests to avoid rate limiting
        if (priceUpdates.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Fetch quote data from Yahoo Finance
        const quoteResponse = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=5m&range=1d`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          }
        );
        
        if (!quoteResponse.ok) {
          console.error(`Failed to fetch data for ${symbol}: HTTP ${quoteResponse.status}`);
          continue;
        }

        // Check if response is JSON
        const contentType = quoteResponse.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.error(`Non-JSON response for ${symbol}: ${contentType}`);
          continue;
        }
        
        const quoteData = await quoteResponse.json();
        const result = quoteData.chart?.result?.[0];
        
        if (result && result.indicators?.quote?.[0]) {
          const quote = result.indicators.quote[0];
          const timestamps = result.timestamp || [];
          const closes = quote.close || [];
          
          // Filter out null values and get valid prices
          const validPrices = closes
            .map((price: number | null, idx: number) => ({ price, time: timestamps[idx] }))
            .filter((item: any) => item.price !== null);
          
          if (validPrices.length > 0) {
            const currentPrice = validPrices[validPrices.length - 1].price;
            const dayOpen = validPrices[0].price;
            const dayChangePct = ((currentPrice - dayOpen) / dayOpen) * 100;
            
            // Extract prices for sparkline (sample every few points for performance)
            const step = Math.max(1, Math.ceil(validPrices.length / 20));
            const intradayPrices = validPrices
              .filter((_: any, idx: number) => idx % step === 0)
              .map((item: any) => item.price);
            
            priceUpdates.push({
              symbol,
              underlying_price: currentPrice,
              day_open: dayOpen,
              day_change_pct: dayChangePct,
              intraday_prices: intradayPrices,
              last_updated: new Date().toISOString(),
            });
          }
        }
      } catch (error) {
        console.error(`Error fetching ${symbol}:`, error);
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
