import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory cache (expires after 5 minutes)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 300000; // 5 minutes

const FINNHUB_API_KEY = Deno.env.get('FINNHUB_API_KEY');

// Helper to get next expiration dates (3rd Friday of month)
function getNextExpirations(count: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  let currentMonth = today.getMonth();
  let currentYear = today.getFullYear();
  
  while (dates.length < count) {
    // Find 3rd Friday of the month
    const firstDay = new Date(currentYear, currentMonth, 1);
    const firstFriday = firstDay.getDay() <= 5 
      ? 1 + (5 - firstDay.getDay()) 
      : 1 + (12 - firstDay.getDay());
    const thirdFriday = firstFriday + 14;
    
    const expirationDate = new Date(currentYear, currentMonth, thirdFriday);
    
    // Only add if it's in the future
    if (expirationDate > today) {
      dates.push(expirationDate.toISOString().split('T')[0]);
    }
    
    // Move to next month
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
  }
  
  return dates;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol } = await req.json();

    if (!symbol) {
      throw new Error('Symbol is required');
    }

    if (!FINNHUB_API_KEY) {
      throw new Error('FINNHUB_API_KEY not configured');
    }

    console.log(`Fetching option chain for ${symbol} from Finnhub.io`);

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
    const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`;
    console.log(`Fetching stock quote for ${symbol}`);
    
    const quoteResponse = await fetch(quoteUrl);
    
    if (!quoteResponse.ok) {
      const errorText = await quoteResponse.text();
      console.error(`Quote fetch failed: ${quoteResponse.status} - ${errorText}`);
      throw new Error(`Failed to fetch stock quote: ${quoteResponse.status}`);
    }
    
    const quoteData = await quoteResponse.json();
    
    if (!quoteData.c) {
      throw new Error(`No quote data found for ${symbol}`);
    }
    
    const underlyingPrice = quoteData.c; // Current price
    console.log(`Underlying price for ${symbol}: $${underlyingPrice}`);

    // Step 2: Get next 4 expiration dates
    const expirationDates = getNextExpirations(4);
    console.log(`Processing ${expirationDates.length} expiration dates:`, expirationDates);
    
    const optionsByExpiration: Record<string, any[]> = {};
    
    // Fetch options for each expiration
    for (const expDate of expirationDates) {
      try {
        const optionsUrl = `https://finnhub.io/api/v1/stock/option-chain?symbol=${symbol}&date=${expDate}&token=${FINNHUB_API_KEY}`;
        console.log(`Fetching options for expiration ${expDate}`);
        
        const optionsResponse = await fetch(optionsUrl);
        
        if (!optionsResponse.ok) {
          console.error(`Options fetch failed for ${expDate}: ${optionsResponse.status}`);
          continue;
        }
        
        const optionsData = await optionsResponse.json();
        
        console.log(`Finnhub response for ${expDate}:`, JSON.stringify(optionsData).substring(0, 500));
        
        if (!optionsData.data || optionsData.data.length === 0) {
          console.log(`No options data for ${expDate} - data:`, optionsData.data);
          continue;
        }
        
        // Filter for PUT options only
        const putOptions = optionsData.data
          .filter((opt: any) => opt.type === 'put')
          .map((opt: any) => ({
            strike: opt.strike,
            bid: opt.bid || 0,
            ask: opt.ask || 0,
            mid: opt.bid && opt.ask ? (opt.bid + opt.ask) / 2 : opt.last || 0,
            volume: opt.volume || 0,
            openInterest: opt.openInterest || 0,
            impliedVolatility: opt.impliedVolatility || 0,
            delta: 0, // Finnhub doesn't provide greeks in basic plan
            inTheMoney: opt.strike > underlyingPrice
          }))
          .sort((a: any, b: any) => b.strike - a.strike); // Sort by strike descending
        
        if (putOptions.length > 0) {
          // Convert date to timestamp for consistency with frontend
          const timestamp = new Date(expDate).getTime() / 1000;
          optionsByExpiration[timestamp.toString()] = putOptions;
          console.log(`Added ${putOptions.length} put options for expiration ${expDate}`);
        }
      } catch (error) {
        console.error(`Error fetching options for ${expDate}:`, error);
      }
      
      // Rate limiting: small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
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
