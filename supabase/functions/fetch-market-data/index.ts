import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { symbol } = await req.json();

    if (!symbol) {
      return new Response(
        JSON.stringify({ error: 'Symbol is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use Yahoo Finance as free option (no API key required)
    // Format: https://query1.finance.yahoo.com/v8/finance/chart/SYMBOL
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
    
    const response = await fetch(yahooUrl);
    const data = await response.json();

    if (!data.chart?.result?.[0]?.meta?.regularMarketPrice) {
      return new Response(
        JSON.stringify({ error: 'Could not fetch market data for symbol' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const price = data.chart.result[0].meta.regularMarketPrice;

    // Update market_data table
    const { error: upsertError } = await supabase
      .from('market_data')
      .upsert({
        symbol: symbol.toUpperCase(),
        underlying_price: price,
        last_updated: new Date().toISOString(),
      }, { onConflict: 'symbol' });

    if (upsertError) {
      console.error('Error updating market data:', upsertError);
    }

    console.log(`Fetched market data for ${symbol}: $${price}`);

    return new Response(
      JSON.stringify({ symbol, underlying_price: price }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching market data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch market data';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});