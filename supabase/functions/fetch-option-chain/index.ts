import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory cache (expires after 5 minutes)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 300000; // 5 minutes

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol } = await req.json();

    if (!symbol) {
      throw new Error('Symbol is required');
    }

    console.log(`Fetching option chain for ${symbol} from Market Data`);
    
    const MARKET_DATA_TOKEN = Deno.env.get('MARKET_DATA_TOKEN');
    if (!MARKET_DATA_TOKEN) {
      throw new Error('MARKET_DATA_TOKEN not configured');
    }

    // Check cache first
    const cacheKey = `chain_${symbol}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData && (Date.now() - cachedData.timestamp < CACHE_DURATION)) {
      console.log(`Using cached data for ${symbol}`);
      return new Response(
        JSON.stringify(cachedData.data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Get underlying price
    const quoteUrl = `https://api.marketdata.app/v1/stocks/quotes/${symbol}/?token=${MARKET_DATA_TOKEN}`;
    console.log(`Fetching stock quote for ${symbol}`);
    
    const quoteResponse = await fetch(quoteUrl);
    
    if (!quoteResponse.ok) {
      const errorText = await quoteResponse.text();
      throw new Error(`Failed to fetch stock quote: ${quoteResponse.status} - ${errorText}`);
    }
    
    const quoteData = await quoteResponse.json();
    
    if (quoteData.s !== 'ok' || !quoteData.last || quoteData.last.length === 0) {
      throw new Error(`No quote data found for ${symbol}`);
    }
    
    const underlyingPrice = quoteData.last[0];
    console.log(`Underlying price for ${symbol}: $${underlyingPrice}`);

    // Step 2: Get options chain - get next 4 expirations
    const chainUrl = `https://api.marketdata.app/v1/options/chain/${symbol}/?token=${MARKET_DATA_TOKEN}`;
    console.log(`Fetching options chain for ${symbol}`);
    
    const chainResponse = await fetch(chainUrl);
    
    if (!chainResponse.ok) {
      const errorText = await chainResponse.text();
      throw new Error(`Failed to fetch options chain: ${chainResponse.status} - ${errorText}`);
    }
    
    const chainData = await chainResponse.json();
    
    if (chainData.s !== 'ok' || !chainData.optionSymbol || chainData.optionSymbol.length === 0) {
      throw new Error(`No options data found for ${symbol}`);
    }

    console.log(`Found ${chainData.optionSymbol.length} option contracts`);

    // Group by expiration and filter for puts
    const optionsByExpiration: Record<string, any[]> = {};
    
    for (let i = 0; i < chainData.optionSymbol.length; i++) {
      const optionType = chainData.side?.[i];
      
      // Only include put options
      if (optionType !== 'put') {
        continue;
      }
      
      const expiration = chainData.expiration?.[i];
      if (!expiration) continue;
      
      if (!optionsByExpiration[expiration]) {
        optionsByExpiration[expiration] = [];
      }
      
      optionsByExpiration[expiration].push({
        strike: chainData.strike?.[i] || 0,
        bid: chainData.bid?.[i] || 0,
        ask: chainData.ask?.[i] || 0,
        mid: chainData.mid?.[i] || 0,
        volume: chainData.volume?.[i] || 0,
        openInterest: chainData.openInterest?.[i] || 0,
        impliedVolatility: chainData.iv?.[i] || 0,
        delta: chainData.delta?.[i] || 0,
        inTheMoney: chainData.inTheMoney?.[i] || false
      });
    }

    // Get up to 4 nearest expirations
    const expirations = Object.keys(optionsByExpiration).sort().slice(0, 4);
    console.log(`Processing ${expirations.length} expiration dates:`, expirations);
    
    const optionsData: Record<string, any[]> = {};
    
    for (const expiration of expirations) {
      const options = optionsByExpiration[expiration];
      console.log(`Added ${options.length} put options for ${expiration}`);
      optionsData[expiration] = options;
    }

    const result = {
      symbol,
      underlyingPrice,
      expirations: Object.keys(optionsData),
      options: optionsData,
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
