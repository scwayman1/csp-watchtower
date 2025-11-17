import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory cache for underlying prices (expires after 5 minutes)
const priceCache = new Map<string, { price: number; timestamp: number }>();
const CACHE_DURATION = 300000; // 5 minutes (300 seconds)

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

    const polygonApiKey = Deno.env.get('POLYGON_API_KEY');
    if (!polygonApiKey) {
      throw new Error('POLYGON_API_KEY not configured');
    }

    console.log(`Fetching option chain for ${symbol} from Polygon.io`);

    // Check cache first
    const cached = priceCache.get(symbol);
    let underlyingPrice = 0;
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      console.log(`Using cached price for ${symbol}: $${cached.price}`);
      underlyingPrice = cached.price;
    } else {
      // Get current stock price from Polygon with retry logic
      const tickerUrl = `https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?adjusted=true&apiKey=${polygonApiKey}`;
      
      try {
        const tickerResponse = await fetch(tickerUrl);
        
        if (tickerResponse.status === 429) {
          console.log('Rate limit hit fetching price - using cached or previous data');
          // If we hit rate limit, use cached price if available, otherwise return error with context
          if (cached) {
            console.log(`Using stale cached price for ${symbol}: $${cached.price}`);
            underlyingPrice = cached.price;
          } else {
            return new Response(
              JSON.stringify({ 
                error: 'Rate limit exceeded. Please wait a moment and try again.',
                code: 'RATE_LIMIT'
              }),
              { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else if (!tickerResponse.ok) {
          throw new Error(`Polygon API error fetching price: ${tickerResponse.status}`);
        } else {
          const tickerData = await tickerResponse.json();
          underlyingPrice = tickerData.results?.[0]?.c || 0;
          
          // Cache the price
          priceCache.set(symbol, { price: underlyingPrice, timestamp: Date.now() });
          console.log(`Cached new price for ${symbol}: $${underlyingPrice}`);
        }
      } catch (error) {
        console.error('Error fetching underlying price:', error);
        // Use cached if available, otherwise throw
        if (cached) {
          console.log(`Using stale cached price due to error for ${symbol}: $${cached.price}`);
          underlyingPrice = cached.price;
        } else {
          throw error;
        }
      }
    }

    // Get options contracts from Polygon
    const today = new Date();
    const oneMonthFromNow = new Date(today);
    oneMonthFromNow.setMonth(today.getMonth() + 1);
    
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    
    const optionsUrl = `https://api.polygon.io/v3/reference/options/contracts?underlying_ticker=${symbol}&contract_type=put&expiration_date.gte=${formatDate(today)}&expiration_date.lte=${formatDate(oneMonthFromNow)}&limit=1000&apiKey=${polygonApiKey}`;
    console.log('Fetching options contracts:', optionsUrl);
    const optionsResponse = await fetch(optionsUrl);
    
    if (!optionsResponse.ok) {
      console.error('Polygon API error:', optionsResponse.status, await optionsResponse.text());
      throw new Error(`Polygon API error fetching options: ${optionsResponse.status}`);
    }

    const optionsData = await optionsResponse.json();
    console.log(`Found ${optionsData.results?.length || 0} total option contracts`);
    
    if (!optionsData.results || optionsData.results.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No option data available for this symbol' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get unique expiration dates
    const expirationSet = new Set<string>();
    optionsData.results.forEach((contract: any) => {
      if (contract.expiration_date) {
        expirationSet.add(contract.expiration_date);
      }
    });
    const expirations = Array.from(expirationSet).sort().slice(0, 5);
    console.log(`Processing ${expirations.length} expiration dates:`, expirations);

    // Organize options by expiration date
    const optionsByExpiration: Record<string, any[]> = {};
    let hasQuoteData = false;
    
    for (const expiration of expirations) {
      const contractsForExp = optionsData.results.filter((c: any) => 
        c.expiration_date === expiration && 
        c.strike_price <= underlyingPrice * 1.1 &&
        c.strike_price >= underlyingPrice * 0.8
      );
      
      console.log(`Found ${contractsForExp.length} contracts for ${expiration}`);
      
      const puts = [];
      // Try to fetch quotes, but include contracts even if quotes fail
      for (const contract of contractsForExp.slice(0, 15)) {
        let optionData = {
          strike: contract.strike_price,
          lastPrice: 0,
          bid: 0,
          ask: 0,
          volume: 0,
          openInterest: 0,
          impliedVolatility: 0,
          inTheMoney: contract.strike_price > underlyingPrice,
        };

        try {
          const quoteUrl = `https://api.polygon.io/v3/snapshot/options/${contract.ticker}?apiKey=${polygonApiKey}`;
          const quoteResponse = await fetch(quoteUrl);
          
          if (quoteResponse.ok) {
            const quoteData = await quoteResponse.json();
            const lastQuote = quoteData.results?.last_quote;
            const lastTrade = quoteData.results?.last_trade;
            
            if (lastQuote || lastTrade) {
              hasQuoteData = true;
              optionData = {
                strike: contract.strike_price,
                lastPrice: lastTrade?.price || (lastQuote ? (lastQuote.bid + lastQuote.ask) / 2 : 0),
                bid: lastQuote?.bid || 0,
                ask: lastQuote?.ask || 0,
                volume: quoteData.results?.day?.volume || 0,
                openInterest: quoteData.results?.open_interest || 0,
                impliedVolatility: quoteData.results?.implied_volatility || 0,
                inTheMoney: contract.strike_price > underlyingPrice,
              };
            }
          } else if (quoteResponse.status === 403) {
            console.log(`Quote access not authorized for ${contract.ticker} - showing contract without live pricing`);
          } else {
            console.error(`Failed to fetch quote for ${contract.ticker}:`, quoteResponse.status);
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err) {
          console.error(`Error fetching quote for ${contract.ticker}:`, err);
        }
        
        // Always add the option, even without quote data
        puts.push(optionData);
      }
      
      console.log(`Added ${puts.length} options for ${expiration} (${hasQuoteData ? 'with' : 'without'} live quotes)`);
      
      // Sort by strike price descending
      puts.sort((a, b) => b.strike - a.strike);
      optionsByExpiration[expiration] = puts;
    }

    return new Response(
      JSON.stringify({
        symbol,
        underlyingPrice,
        expirations,
        optionsByExpiration,
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