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

    console.log(`Fetching option chain for ${symbol} from Finnhub.io`);

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
      const errorText = await quoteResponse.text();
      console.error(`Quote fetch failed: ${quoteResponse.status} - ${errorText}`);
      throw new Error(`Failed to fetch stock quote: ${quoteResponse.status}`);
    }
    
    const quoteData = await quoteResponse.json();
    
    if (!quoteData.c) {
      console.error(`No quote data found for ${symbol}. This may be an invalid ticker symbol.`);
      throw new Error(`Invalid ticker symbol: "${symbol}". Please verify the ticker and try again. (e.g., "DAL" for Delta Air Lines)`);
    }
    
    const underlyingPrice = quoteData.c; // Current price
    console.log(`Underlying price for ${symbol}: $${underlyingPrice}`);

    // Step 2: Fetch options from Finnhub (limit to 3 total expirations max)
    const expirationDates = getNextExpirations(2, 1); // 2 weekly + 1 monthly as hints
    console.log(`Fetching options for ${symbol} (dates are hints to Finnhub)`);
    
    const optionsByExpiration: Record<string, any[]> = {};
    const seenExpirations = new Set<string>();
    const MAX_EXPIRATIONS = 3; // Limit to prevent CPU timeout
    
    // Fetch options - Finnhub returns actual expirations available
    const fetchPromises = expirationDates.map(async (hintDate) => {
      try {
        const optionsUrl = `https://finnhub.io/api/v1/stock/option-chain?symbol=${symbol}&date=${hintDate}&token=${FINNHUB_API_KEY}`;
        console.log(`Fetching options for ${symbol} (hint date: ${hintDate})`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
        
        const optionsResponse = await fetch(optionsUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!optionsResponse.ok) {
          console.error(`Options fetch failed: ${optionsResponse.status}`);
          return [];
        }
        
        const optionsData = await optionsResponse.json();
        
        // Finnhub returns all available expirations in data array
        if (!optionsData.data || optionsData.data.length === 0) {
          console.log(`No options data returned`);
          return [];
        }

        const results: any[] = [];
        
        // Process only the first expiration from each fetch to limit CPU usage
        const expirationData = optionsData.data[0];
        if (!expirationData) {
          return [];
        }
        
        const actualExpDate = expirationData.expirationDate;
        
        // Skip if we've already processed this expiration or hit limit
        if (seenExpirations.has(actualExpDate) || seenExpirations.size >= MAX_EXPIRATIONS) {
          return [];
        }
        seenExpirations.add(actualExpDate);
        
        if (!expirationData.options || !expirationData.options[optionType]) {
          return [];
        }
        
        console.log(`Processing ${optionType} options for expiration ${actualExpDate}`);
        
        // Map Finnhub options to our format
        const options = expirationData.options[optionType]
          .map((opt: any) => ({
            strike: opt.strike || 0,
            bid: opt.bid || 0,
            ask: opt.ask || 0,
            mid: opt.bid && opt.ask ? (opt.bid + opt.ask) / 2 : opt.lastTradePrice || 0,
            volume: opt.volume || 0,
            openInterest: opt.openInterest || 0,
            impliedVolatility: opt.impliedVolatility || expirationData.impliedVolatility || 0,
            delta: opt.delta || 0,
            inTheMoney: optionType === 'PUT' 
              ? (opt.inTheMoney === "TRUE" || opt.strike > underlyingPrice)
              : (opt.inTheMoney === "TRUE" || opt.strike < underlyingPrice),
            lastPrice: opt.lastTradePrice || 0
          }))
          .filter((opt: any) => opt.strike > 0) // Filter out invalid strikes
          .sort((a: any, b: any) => b.strike - a.strike); // Sort by strike descending
        
        if (options.length > 0) {
          // Use actual expiration date from Finnhub
          const timestamp = new Date(actualExpDate).getTime() / 1000;
          console.log(`Found ${options.length} ${optionType} options for ${actualExpDate}`);
          results.push({ timestamp: timestamp.toString(), options });
        }
        
        return results;
      } catch (error) {
        console.error(`Error fetching options:`, error);
        return [];
      }
    });
    
    // Wait for all requests to complete
    const allResults = await Promise.all(fetchPromises);
    
    // Flatten and build the options object
    allResults.flat().forEach(result => {
      if (result && result.options) {
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
