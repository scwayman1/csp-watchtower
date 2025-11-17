import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory cache (expires after 5 minutes)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 300000; // 5 minutes

const POLYGON_API_KEY = Deno.env.get('POLYGON_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol } = await req.json();

    if (!symbol) {
      throw new Error('Symbol is required');
    }

    if (!POLYGON_API_KEY) {
      throw new Error('POLYGON_API_KEY not configured');
    }

    console.log(`Fetching option chain for ${symbol} from Polygon.io`);

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
    const quoteUrl = `https://api.polygon.io/v2/last/trade/${symbol}?apiKey=${POLYGON_API_KEY}`;
    console.log(`Fetching stock quote for ${symbol}`);
    
    const quoteResponse = await fetch(quoteUrl);
    
    if (!quoteResponse.ok) {
      const errorText = await quoteResponse.text();
      console.error(`Quote fetch failed: ${quoteResponse.status} - ${errorText}`);
      throw new Error(`Failed to fetch stock quote: ${quoteResponse.status}`);
    }
    
    const quoteData = await quoteResponse.json();
    
    if (!quoteData.results?.p) {
      throw new Error(`No quote data found for ${symbol}`);
    }
    
    const underlyingPrice = quoteData.results.p;
    console.log(`Underlying price for ${symbol}: $${underlyingPrice}`);

    // Step 2: Get options contracts
    const today = new Date();
    const maxDate = new Date(today.getTime() + 120 * 24 * 60 * 60 * 1000); // 120 days out
    const contractsUrl = `https://api.polygon.io/v3/reference/options/contracts?underlying_ticker=${symbol}&contract_type=put&expiration_date.lte=${maxDate.toISOString().split('T')[0]}&limit=1000&apiKey=${POLYGON_API_KEY}`;
    
    console.log(`Fetching options contracts for ${symbol}`);
    
    const contractsResponse = await fetch(contractsUrl);
    
    if (!contractsResponse.ok) {
      const errorText = await contractsResponse.text();
      console.error(`Contracts fetch failed: ${contractsResponse.status} - ${errorText}`);
      throw new Error(`Failed to fetch options contracts: ${contractsResponse.status}`);
    }
    
    const contractsData = await contractsResponse.json();
    
    if (!contractsData.results || contractsData.results.length === 0) {
      throw new Error(`No options contracts found for ${symbol}`);
    }

    // Group by expiration date
    const contractsByExpiration: Record<string, any[]> = {};
    
    for (const contract of contractsData.results) {
      const expDate = contract.expiration_date;
      if (!contractsByExpiration[expDate]) {
        contractsByExpiration[expDate] = [];
      }
      contractsByExpiration[expDate].push(contract);
    }
    
    // Get up to 4 nearest expirations
    const expirationDates = Object.keys(contractsByExpiration).sort().slice(0, 4);
    console.log(`Processing ${expirationDates.length} expiration dates`);
    
    const optionsByExpiration: Record<string, any[]> = {};
    
    // Fetch quotes for each expiration
    for (const expDate of expirationDates) {
      const contracts = contractsByExpiration[expDate];
      const formattedOptions: any[] = [];
      
      // Batch fetch quotes for this expiration (limit to avoid rate limits)
      const contractsToFetch = contracts.slice(0, 50);
      
      for (const contract of contractsToFetch) {
        try {
          const quoteUrl = `https://api.polygon.io/v3/quotes/${contract.ticker}?limit=1&apiKey=${POLYGON_API_KEY}`;
          const quoteRes = await fetch(quoteUrl);
          
          if (quoteRes.ok) {
            const quoteJson = await quoteRes.json();
            const quote = quoteJson.results?.[0];
            
            if (quote) {
              formattedOptions.push({
                strike: contract.strike_price,
                bid: quote.bid_price || 0,
                ask: quote.ask_price || 0,
                mid: quote.bid_price && quote.ask_price ? (quote.bid_price + quote.ask_price) / 2 : 0,
                volume: 0, // Volume requires separate API call
                openInterest: 0, // OI requires separate API call
                impliedVolatility: 0, // IV requires separate API call or calculation
                delta: 0, // Greeks require separate API call
                inTheMoney: contract.strike_price > underlyingPrice
              });
            }
          }
          
          // Rate limiting: small delay between requests
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
          console.error(`Error fetching quote for ${contract.ticker}:`, error);
        }
      }
      
      if (formattedOptions.length > 0) {
        // Convert date to timestamp for consistency with frontend
        const timestamp = new Date(expDate).getTime() / 1000;
        optionsByExpiration[timestamp.toString()] = formattedOptions;
        console.log(`Added ${formattedOptions.length} put options for expiration ${expDate}`);
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
