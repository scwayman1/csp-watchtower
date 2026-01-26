import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory cache (expires after 60 minutes)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 60 * 60 * 1000; // 60 minutes
const REQUEST_TIMEOUT = 5000; // 5 seconds per request

const FINNHUB_API_KEY = Deno.env.get('FINNHUB_API_KEY');

// Helper to get next expiration date (just one Friday)
function getNextFriday(): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const daysUntilFriday = (5 - today.getDay() + 7) % 7;
  const nextFriday = new Date(today);
  nextFriday.setDate(today.getDate() + (daysUntilFriday === 0 ? 7 : daysUntilFriday));
  
  return nextFriday.toISOString().split('T')[0];
}

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

    if (!FINNHUB_API_KEY) {
      console.error('FINNHUB_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Market data service not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching option chain for ${symbol} (${optionType})`);

    // Check cache first
    const cacheKey = `chain_${symbol}_${optionType}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData && (Date.now() - cachedData.timestamp < CACHE_DURATION)) {
      console.log(`Using cached data for ${symbol}`);
      return new Response(
        JSON.stringify(cachedData.data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Get underlying price
    const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`;
    console.log(`Fetching stock quote for ${symbol}`);
    
    const quoteResponse = await fetch(quoteUrl);
    
    if (!quoteResponse.ok) {
      console.error(`Failed to fetch stock quote: ${quoteResponse.status}`);
      return new Response(
        JSON.stringify({ error: `Unable to fetch quote for "${symbol}". Please try again.` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const quoteData = await quoteResponse.json();
    
    // Finnhub returns { c: 0, d: null, dp: null, h: 0, l: 0, o: 0, pc: 0, t: 0 } for invalid symbols
    if (!quoteData.c || quoteData.c === 0) {
      console.log(`Invalid ticker symbol: "${symbol}" - no quote data found`);
      return new Response(
        JSON.stringify({ 
          error: `"${symbol}" is not a valid ticker symbol. Please check the symbol and try again.`,
          invalidSymbol: true 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const underlyingPrice = quoteData.c;
    console.log(`Underlying price for ${symbol}: $${underlyingPrice}`);

    // Step 2: Fetch options from Finnhub (single request)
    const hintDate = getNextFriday();
    const optionsUrl = `https://finnhub.io/api/v1/stock/option-chain?symbol=${symbol}&date=${hintDate}&token=${FINNHUB_API_KEY}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    
    let optionsResponse;
    try {
      optionsResponse = await fetch(optionsUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error(`Options fetch timed out for ${symbol}`);
        return new Response(
          JSON.stringify({ error: 'Request timed out. Please try again.' }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw fetchError;
    }
    
    if (!optionsResponse.ok) {
      console.error(`Failed to fetch options: ${optionsResponse.status}`);
      return new Response(
        JSON.stringify({ error: `Unable to fetch options data for "${symbol}". The symbol may not have options available.` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const optionsData = await optionsResponse.json();
    
    const optionsByExpiration: Record<string, any[]> = {};
    
    if (optionsData.data && optionsData.data.length > 0) {
      // Process multiple expirations (up to 4) with lean processing
      // Return wider strike range to let frontend handle filtering
      const strikeMin = underlyingPrice * 0.50;  // 50% below current price
      const strikeMax = underlyingPrice * 1.50;  // 50% above current price
      const MAX_OPTIONS_PER_EXP = 50;  // Increased to show more options
      const MAX_SCAN = 500;
      const MAX_EXPIRATIONS = 4;

      const expirationsToProcess = optionsData.data.slice(0, MAX_EXPIRATIONS);
      
      for (const expData of expirationsToProcess) {
        if (!expData?.options?.[optionType]) continue;
        
        const actualExpDate = expData.expirationDate;
        const rawOptions = expData.options[optionType] as any[];

        const filteredOptions: any[] = [];
        const scanLimit = Math.min(rawOptions.length, MAX_SCAN);
        
        for (let j = 0; j < scanLimit && filteredOptions.length < MAX_OPTIONS_PER_EXP; j++) {
          const opt = rawOptions[j];
          const strike = opt?.strike;
          if (typeof strike !== 'number') continue;

          if (strike >= strikeMin && strike <= strikeMax) {
            const bid = opt.bid || 0;
            const ask = opt.ask || 0;
            filteredOptions.push({
              strike,
              bid,
              ask,
              mid: bid && ask ? (bid + ask) / 2 : opt.lastTradePrice || 0,
              volume: opt.volume || 0,
              openInterest: opt.openInterest || 0,
              impliedVolatility: opt.impliedVolatility || 0,
              delta: opt.delta || 0,
              inTheMoney: optionType === 'PUT' ? strike > underlyingPrice : strike < underlyingPrice,
              lastPrice: opt.lastTradePrice || 0,
            });
          }
        }

        if (filteredOptions.length > 0) {
          filteredOptions.sort((a, b) => b.strike - a.strike);
          const timestamp = (new Date(actualExpDate).getTime() / 1000).toString();
          optionsByExpiration[timestamp] = filteredOptions;
          console.log(
            `Processed expiration ${actualExpDate}: kept ${filteredOptions.length} options`,
          );
        }
      }
      
      console.log(`Total expirations processed: ${Object.keys(optionsByExpiration).length}`);
    }

    const result = {
      symbol,
      underlyingPrice,
      expirations: Object.keys(optionsByExpiration),
      options: optionsByExpiration,
      timestamp: Date.now()
    };

    // Cache the result
    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    console.log(`Cached options chain for ${symbol}`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching option chain:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
