import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory cache (expires after 15 minutes)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 900000; // 15 minutes
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
      throw new Error('Symbol is required');
    }
    
    if (optionType !== 'PUT' && optionType !== 'CALL') {
      throw new Error('optionType must be either PUT or CALL');
    }

    if (!FINNHUB_API_KEY) {
      throw new Error('FINNHUB_API_KEY not configured');
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
      throw new Error(`Failed to fetch stock quote: ${quoteResponse.status}`);
    }
    
    const quoteData = await quoteResponse.json();
    
    if (!quoteData.c) {
      throw new Error(`Invalid ticker symbol: "${symbol}"`);
    }
    
    const underlyingPrice = quoteData.c;
    console.log(`Underlying price for ${symbol}: $${underlyingPrice}`);

    // Step 2: Fetch options from Finnhub (single request)
    const hintDate = getNextFriday();
    const optionsUrl = `https://finnhub.io/api/v1/stock/option-chain?symbol=${symbol}&date=${hintDate}&token=${FINNHUB_API_KEY}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    
    const optionsResponse = await fetch(optionsUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!optionsResponse.ok) {
      throw new Error(`Failed to fetch options: ${optionsResponse.status}`);
    }
    
    const optionsData = await optionsResponse.json();
    
    const optionsByExpiration: Record<string, any[]> = {};
    
    if (optionsData.data && optionsData.data.length > 0) {
      // Process only first 3 expirations max
      const maxExpirations = Math.min(3, optionsData.data.length);
      const strikeMin = underlyingPrice * 0.85;
      const strikeMax = underlyingPrice * 1.15;
      
      for (let i = 0; i < maxExpirations; i++) {
        const expData = optionsData.data[i];
        if (!expData || !expData.options || !expData.options[optionType]) continue;
        
        const actualExpDate = expData.expirationDate;
        const rawOptions = expData.options[optionType];
        
        // Limit to 15 options per expiration within strike range
        const filteredOptions = [];
        for (let j = 0; j < rawOptions.length && filteredOptions.length < 15; j++) {
          const opt = rawOptions[j];
          if (opt.strike >= strikeMin && opt.strike <= strikeMax) {
            filteredOptions.push({
              strike: opt.strike,
              bid: opt.bid || 0,
              ask: opt.ask || 0,
              mid: opt.bid && opt.ask ? (opt.bid + opt.ask) / 2 : opt.lastTradePrice || 0,
              volume: opt.volume || 0,
              openInterest: opt.openInterest || 0,
              impliedVolatility: opt.impliedVolatility || 0,
              delta: opt.delta || 0,
              inTheMoney: optionType === 'PUT' ? opt.strike > underlyingPrice : opt.strike < underlyingPrice,
              lastPrice: opt.lastTradePrice || 0
            });
          }
        }
        
        if (filteredOptions.length > 0) {
          // Sort by strike descending
          filteredOptions.sort((a, b) => b.strike - a.strike);
          const timestamp = (new Date(actualExpDate).getTime() / 1000).toString();
          optionsByExpiration[timestamp] = filteredOptions;
          console.log(`Found ${filteredOptions.length} options for ${actualExpDate}`);
        }
      }
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
