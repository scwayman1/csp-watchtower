import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol } = await req.json();
    
    if (!symbol) {
      return new Response(
        JSON.stringify({ error: 'Symbol is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching option chain for ${symbol}`);

    // Fetch option chain data from Yahoo Finance
    const yahooUrl = `https://query2.finance.yahoo.com/v7/finance/options/${symbol}`;
    const response = await fetch(yahooUrl);
    
    if (!response.ok) {
      throw new Error(`Yahoo Finance API error: ${response.status}`);
    }

    const data = await response.json();
    const optionChain = data.optionChain?.result?.[0];
    
    if (!optionChain) {
      return new Response(
        JSON.stringify({ error: 'No option data available for this symbol' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current stock price
    const underlyingPrice = optionChain.quote?.regularMarketPrice || 0;

    // Process expirations
    const expirations = optionChain.expirationDates?.map((timestamp: number) => {
      const date = new Date(timestamp * 1000);
      return date.toISOString().split('T')[0];
    }) || [];

    // Process put options
    const puts = optionChain.options?.[0]?.puts?.map((put: any) => ({
      strike: put.strike,
      lastPrice: put.lastPrice,
      bid: put.bid,
      ask: put.ask,
      volume: put.volume,
      openInterest: put.openInterest,
      impliedVolatility: put.impliedVolatility,
      delta: put.delta,
      inTheMoney: put.inTheMoney,
    })) || [];

    return new Response(
      JSON.stringify({
        symbol,
        underlyingPrice,
        expirations,
        puts,
        lastUpdate: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching option chain:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});