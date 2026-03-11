import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Simple in-memory cache (expires after 60 minutes)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 60 * 60 * 1000;
const REQUEST_TIMEOUT = 10000;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol, optionType = 'PUT' } = await req.json();

    if (!symbol) {
      return new Response(
        JSON.stringify({ error: 'Symbol is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (optionType !== 'PUT' && optionType !== 'CALL') {
      return new Response(
        JSON.stringify({ error: 'optionType must be either PUT or CALL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const upperSymbol = symbol.toUpperCase();
    console.log(`Fetching option chain for ${upperSymbol} (${optionType})`);

    // Check cache
    const cacheKey = `chain_${upperSymbol}_${optionType}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData && (Date.now() - cachedData.timestamp < CACHE_DURATION)) {
      console.log(`Using cached data for ${upperSymbol}`);
      return new Response(
        JSON.stringify(cachedData.data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Get all expiration dates from Yahoo Finance
    const baseUrl = `https://query1.finance.yahoo.com/v7/finance/options/${upperSymbol}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    let initialRes;
    try {
      initialRes = await fetch(baseUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return new Response(
          JSON.stringify({ error: 'Request timed out. Please try again.' }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw fetchError;
    }

    if (!initialRes.ok) {
      const body = await initialRes.text();
      console.error(`Yahoo options failed: ${initialRes.status} ${body.substring(0, 200)}`);
      
      if (initialRes.status === 404) {
        return new Response(
          JSON.stringify({ error: `"${upperSymbol}" is not a valid ticker symbol.`, invalidSymbol: true }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: `Unable to fetch options for "${upperSymbol}".` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const initialData = await initialRes.json();
    const optionChain = initialData?.optionChain;

    if (!optionChain?.result?.[0]) {
      return new Response(
        JSON.stringify({ error: `"${upperSymbol}" is not a valid ticker symbol.`, invalidSymbol: true }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result0 = optionChain.result[0];
    const underlyingPrice = result0.quote?.regularMarketPrice || 0;

    if (!underlyingPrice) {
      return new Response(
        JSON.stringify({ error: `No price data for "${upperSymbol}".`, invalidSymbol: true }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Underlying price for ${upperSymbol}: $${underlyingPrice}`);

    const allExpirations: number[] = result0.expirationDates || [];
    
    // Take the first 4 expirations
    const expirationsToFetch = allExpirations.slice(0, 4);
    console.log(`Processing ${expirationsToFetch.length} expirations`);

    const optionsByExpiration: Record<string, any[]> = {};
    const strikeMin = underlyingPrice * 0.50;
    const strikeMax = underlyingPrice * 1.50;

    // Process the first expiration from the initial response
    const processOptions = (options: any[]): any[] => {
      const filtered: any[] = [];
      for (const opt of options) {
        const strike = opt.strike || 0;
        if (strike < strikeMin || strike > strikeMax) continue;

        const bid = opt.bid || 0;
        const ask = opt.ask || 0;
        filtered.push({
          strike,
          bid,
          ask,
          mid: bid && ask ? (bid + ask) / 2 : opt.lastPrice || 0,
          volume: opt.volume || 0,
          openInterest: opt.openInterest || 0,
          impliedVolatility: opt.impliedVolatility || 0,
          delta: 0, // Yahoo doesn't provide greeks in free tier
          inTheMoney: opt.inTheMoney || false,
          lastPrice: opt.lastPrice || 0,
        });
      }
      return filtered.sort((a, b) => b.strike - a.strike).slice(0, 50);
    };

    // Process first expiration from initial request
    if (result0.options?.[0]) {
      const firstExp = result0.options[0];
      const expTs = String(firstExp.expirationDate);
      const rawOptions = optionType === 'PUT' ? (firstExp.puts || []) : (firstExp.calls || []);
      const processed = processOptions(rawOptions);
      if (processed.length > 0) {
        optionsByExpiration[expTs] = processed;
        console.log(`Exp ${expTs}: ${processed.length} options`);
      }
    }

    // Fetch remaining expirations (skip first since we already have it)
    const remainingExps = expirationsToFetch.slice(1);
    
    for (const expDate of remainingExps) {
      try {
        const expUrl = `${baseUrl}?date=${expDate}`;
        const expRes = await fetch(expUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });
        
        if (!expRes.ok) {
          await expRes.text();
          continue;
        }

        const expData = await expRes.json();
        const expResult = expData?.optionChain?.result?.[0]?.options?.[0];
        
        if (expResult) {
          const expTs = String(expResult.expirationDate);
          const rawOptions = optionType === 'PUT' ? (expResult.puts || []) : (expResult.calls || []);
          const processed = processOptions(rawOptions);
          if (processed.length > 0) {
            optionsByExpiration[expTs] = processed;
            console.log(`Exp ${expTs}: ${processed.length} options`);
          }
        }
      } catch (err) {
        console.error(`Error fetching expiration ${expDate}:`, err);
      }
    }

    const sortedKeys = Object.keys(optionsByExpiration).sort((a, b) => Number(a) - Number(b));

    const response = {
      symbol: upperSymbol,
      underlyingPrice,
      expirations: sortedKeys,
      options: optionsByExpiration,
      timestamp: Date.now(),
    };

    cache.set(cacheKey, { data: response, timestamp: Date.now() });
    console.log(`Cached options chain for ${upperSymbol} (${sortedKeys.length} expirations)`);

    return new Response(
      JSON.stringify(response),
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
