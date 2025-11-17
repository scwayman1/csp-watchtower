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

    console.log(`Fetching option chain for ${symbol} from Yahoo Finance`);

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

    // Step 1: Get underlying price from Yahoo Finance
    const quoteUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
    console.log(`Fetching stock quote for ${symbol}`);
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
    };
    
    const quoteResponse = await fetch(quoteUrl, { headers });
    
    if (!quoteResponse.ok) {
      throw new Error(`Failed to fetch stock quote: ${quoteResponse.status}`);
    }
    
    const quoteData = await quoteResponse.json();
    
    if (!quoteData.chart?.result?.[0]?.meta?.regularMarketPrice) {
      throw new Error(`No quote data found for ${symbol}`);
    }
    
    const underlyingPrice = quoteData.chart.result[0].meta.regularMarketPrice;
    console.log(`Underlying price for ${symbol}: $${underlyingPrice}`);

    // Step 2: Get options expirations
    const optionsUrl = `https://query1.finance.yahoo.com/v7/finance/options/${symbol}`;
    console.log(`Fetching options expirations for ${symbol}`);
    
    const optionsResponse = await fetch(optionsUrl, { headers });
    
    if (!optionsResponse.ok) {
      throw new Error(`Failed to fetch options data: ${optionsResponse.status}`);
    }
    
    const optionsData = await optionsResponse.json();
    
    if (!optionsData.optionChain?.result?.[0]) {
      throw new Error(`No options data found for ${symbol}`);
    }

    const expirationTimestamps = optionsData.optionChain.result[0].expirationDates || [];
    
    // Get up to 4 nearest expirations
    const selectedExpirations = expirationTimestamps.slice(0, 4);
    console.log(`Processing ${selectedExpirations.length} expiration dates`);
    
    const optionsByExpiration: Record<string, any[]> = {};
    
    // Fetch options for each expiration
    for (const expTimestamp of selectedExpirations) {
      const expUrl = `https://query1.finance.yahoo.com/v7/finance/options/${symbol}?date=${expTimestamp}`;
      
      try {
        const expResponse = await fetch(expUrl, { headers });
        if (!expResponse.ok) continue;
        
        const expData = await expResponse.json();
        const puts = expData.optionChain?.result?.[0]?.options?.[0]?.puts || [];
        
        if (puts.length === 0) continue;
        
        const formattedOptions = puts.map((put: any) => ({
          strike: put.strike || 0,
          bid: put.bid || 0,
          ask: put.ask || 0,
          mid: ((put.bid || 0) + (put.ask || 0)) / 2,
          volume: put.volume || 0,
          openInterest: put.openInterest || 0,
          impliedVolatility: put.impliedVolatility || 0,
          delta: 0, // Yahoo Finance doesn't provide Greeks in free API
          inTheMoney: put.inTheMoney || false
        }));
        
        optionsByExpiration[expTimestamp.toString()] = formattedOptions;
        console.log(`Added ${formattedOptions.length} put options for expiration ${expTimestamp}`);
      } catch (error) {
        console.error(`Error fetching options for expiration ${expTimestamp}:`, error);
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
