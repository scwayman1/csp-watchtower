import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Get current stock price from Polygon
    const tickerUrl = `https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?adjusted=true&apiKey=${polygonApiKey}`;
    const tickerResponse = await fetch(tickerUrl);
    
    if (!tickerResponse.ok) {
      throw new Error(`Polygon API error fetching price: ${tickerResponse.status}`);
    }

    const tickerData = await tickerResponse.json();
    const underlyingPrice = tickerData.results?.[0]?.c || 0;

    // Get options contracts from Polygon
    const today = new Date();
    const oneMonthFromNow = new Date(today);
    oneMonthFromNow.setMonth(today.getMonth() + 1);
    
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    
    const optionsUrl = `https://api.polygon.io/v3/reference/options/contracts?underlying_ticker=${symbol}&contract_type=put&expiration_date.gte=${formatDate(today)}&expiration_date.lte=${formatDate(oneMonthFromNow)}&limit=1000&apiKey=${polygonApiKey}`;
    const optionsResponse = await fetch(optionsUrl);
    
    if (!optionsResponse.ok) {
      throw new Error(`Polygon API error fetching options: ${optionsResponse.status}`);
    }

    const optionsData = await optionsResponse.json();
    
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
    const expirations = Array.from(expirationSet).sort().slice(0, 5); // Limit to first 5 expirations

    // Organize options by expiration date
    const optionsByExpiration: Record<string, any[]> = {};
    
    for (const expiration of expirations) {
      const contractsForExp = optionsData.results.filter((c: any) => 
        c.expiration_date === expiration && 
        c.strike_price <= underlyingPrice * 1.1 &&
        c.strike_price >= underlyingPrice * 0.8
      );
      
      const puts = [];
      // Fetch quotes for up to 20 contracts per expiration
      for (const contract of contractsForExp.slice(0, 20)) {
        try {
          const quoteUrl = `https://api.polygon.io/v3/snapshot/options/${contract.ticker}?apiKey=${polygonApiKey}`;
          const quoteResponse = await fetch(quoteUrl);
          
          if (quoteResponse.ok) {
            const quoteData = await quoteResponse.json();
            const lastQuote = quoteData.results?.last_quote;
            const lastTrade = quoteData.results?.last_trade;
            
            if (lastQuote && (lastQuote.bid > 0 || lastQuote.ask > 0)) {
              const mid = (lastQuote.bid + lastQuote.ask) / 2;
              puts.push({
                strike: contract.strike_price,
                lastPrice: lastTrade?.price || mid,
                bid: lastQuote.bid,
                ask: lastQuote.ask,
                volume: quoteData.results?.day?.volume || 0,
                openInterest: quoteData.results?.open_interest || 0,
                impliedVolatility: quoteData.results?.implied_volatility || 0,
                inTheMoney: contract.strike_price > underlyingPrice,
              });
            }
          }
          // Small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (err) {
          console.error(`Error fetching quote for ${contract.ticker}:`, err);
        }
      }
      
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