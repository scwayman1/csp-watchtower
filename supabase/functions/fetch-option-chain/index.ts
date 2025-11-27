import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory cache (expires after 15 minutes)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 900000; // 15 minutes
const REQUEST_TIMEOUT = 3000; // 3 seconds per request

const FINNHUB_API_KEY = Deno.env.get('FINNHUB_API_KEY');

// Helper to get next expiration dates (weekly + monthly)
function getNextExpirations(weeklyCount: number = 4, monthlyCount: number = 2): string[] {
  const dates: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // First, add weekly expirations (next N Fridays)
  const currentDate = new Date(today);
  let weeklyAdded = 0;
  
  while (weeklyAdded < weeklyCount) {
    // Find the next Friday
    const daysUntilFriday = (5 - currentDate.getDay() + 7) % 7;
    const nextFriday = new Date(currentDate);
    nextFriday.setDate(currentDate.getDate() + (daysUntilFriday === 0 ? 7 : daysUntilFriday));
    
    // Only add if it's in the future (after today)
    if (nextFriday > today) {
      const dateStr = nextFriday.toISOString().split('T')[0];
      if (!dates.includes(dateStr)) {
        dates.push(dateStr);
        weeklyAdded++;
      }
    }
    
    // Move to next week
    currentDate.setDate(nextFriday.getDate() + 1);
  }
  
  // Then add monthly expirations (3rd Friday of upcoming months)
  let currentMonth = today.getMonth();
  let currentYear = today.getFullYear();
  let monthlyAdded = 0;
  
  while (monthlyAdded < monthlyCount) {
    // Find 3rd Friday of the month
    const firstDay = new Date(currentYear, currentMonth, 1);
    const firstFriday = firstDay.getDay() <= 5 
      ? 1 + (5 - firstDay.getDay()) 
      : 1 + (12 - firstDay.getDay());
    const thirdFriday = firstFriday + 14;
    
    const expirationDate = new Date(currentYear, currentMonth, thirdFriday);
    const dateStr = expirationDate.toISOString().split('T')[0];
    
    // Only add if it's in the future and not already in the list
    if (expirationDate > today && !dates.includes(dateStr)) {
      dates.push(dateStr);
      monthlyAdded++;
    }
    
    // Move to next month
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
  }
  
  // Sort dates chronologically
  return dates.sort();
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

    // Step 2: Get weekly + monthly expiration dates (reduced to 3 total to avoid timeout)
    const expirationDates = getNextExpirations(2, 1); // 2 weekly + 1 monthly
    console.log(`Processing ${expirationDates.length} expiration dates:`, expirationDates);
    
    const optionsByExpiration: Record<string, any[]> = {};
    
    // Fetch options for all expirations in parallel with timeout
    const fetchPromises = expirationDates.map(async (expDate) => {
      try {
        const optionsUrl = `https://finnhub.io/api/v1/stock/option-chain?symbol=${symbol}&date=${expDate}&token=${FINNHUB_API_KEY}`;
        console.log(`Fetching options for expiration ${expDate}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
        
        const optionsResponse = await fetch(optionsUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!optionsResponse.ok) {
          console.error(`Options fetch failed for ${expDate}: ${optionsResponse.status}`);
          return null;
        }
        
        const optionsData = await optionsResponse.json();
        
        console.log(`Finnhub response for ${expDate}:`, JSON.stringify(optionsData).substring(0, 500));
        
        // Finnhub structure: data[0].options.PUT[] contains the put options
        if (!optionsData.data || optionsData.data.length === 0) {
          console.log(`No options data for ${expDate}`);
          return null;
        }

        const expirationData = optionsData.data.find((d: any) => d.expirationDate === expDate);
        if (!expirationData || !expirationData.options || !expirationData.options.PUT) {
          console.log(`No PUT options found for ${expDate}`);
          return null;
        }
        
        // Map Finnhub PUT options to our format
        const putOptions = expirationData.options.PUT
          .map((opt: any) => ({
            strike: opt.strike || 0,
            bid: opt.bid || 0,
            ask: opt.ask || 0,
            mid: opt.bid && opt.ask ? (opt.bid + opt.ask) / 2 : opt.lastTradePrice || 0,
            volume: opt.volume || 0,
            openInterest: opt.openInterest || 0,
            impliedVolatility: opt.impliedVolatility || expirationData.impliedVolatility || 0,
            delta: opt.delta || 0,
            inTheMoney: opt.inTheMoney === "TRUE" || opt.strike > underlyingPrice
          }))
          .filter((opt: any) => opt.strike > 0) // Filter out invalid strikes
          .sort((a: any, b: any) => b.strike - a.strike); // Sort by strike descending
        
        if (putOptions.length > 0) {
          // Convert date to timestamp for consistency with frontend
          const timestamp = new Date(expDate).getTime() / 1000;
          console.log(`Added ${putOptions.length} put options for expiration ${expDate}`);
          return { timestamp: timestamp.toString(), options: putOptions };
        }
        
        return null;
      } catch (error) {
        console.error(`Error fetching options for ${expDate}:`, error);
        return null;
      }
    });
    
    // Wait for all requests to complete
    const results = await Promise.all(fetchPromises);
    
    // Build the options object from successful results
    results.forEach(result => {
      if (result) {
        optionsByExpiration[result.timestamp] = result.options;
      }
    });

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
