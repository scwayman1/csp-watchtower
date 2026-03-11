import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Simple in-memory cache (expires after 60 minutes)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 60 * 60 * 1000;
const REQUEST_TIMEOUT = 10000;

const POLYGON_API_KEY = Deno.env.get('POLYGON_API_KEY');

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

    if (!POLYGON_API_KEY) {
      console.error('POLYGON_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Market data service not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const upperSymbol = symbol.toUpperCase();
    console.log(`Fetching option chain for ${upperSymbol} (${optionType})`);

    // Check cache
    const cacheKey = `chain_${upperSymbol}_${optionType}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData && (Date.now() - cachedData.timestamp < CACHE_DURATION)) {
      console.log(`Using cached data for ${upperSymbol}`);
      return new Response(
        JSON.stringify(cachedData.data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Get underlying price from Polygon snapshot
    const snapshotUrl = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${upperSymbol}?apiKey=${POLYGON_API_KEY}`;
    const snapshotRes = await fetch(snapshotUrl);
    
    if (!snapshotRes.ok) {
      const body = await snapshotRes.text();
      console.error(`Snapshot failed: ${snapshotRes.status} ${body}`);
      return new Response(
        JSON.stringify({ error: `Unable to fetch quote for "${upperSymbol}".`, invalidSymbol: snapshotRes.status === 404 }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const snapshotData = await snapshotRes.json();
    const underlyingPrice = snapshotData?.ticker?.lastTrade?.p || snapshotData?.ticker?.day?.c || snapshotData?.ticker?.prevDay?.c;

    if (!underlyingPrice) {
      console.log(`No price data for ${upperSymbol}`);
      return new Response(
        JSON.stringify({ error: `"${upperSymbol}" is not a valid ticker symbol.`, invalidSymbol: true }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Underlying price for ${upperSymbol}: $${underlyingPrice}`);

    // Step 2: Fetch option chain from Polygon
    const contractType = optionType === 'PUT' ? 'put' : 'call';
    const strikeMin = Math.floor(underlyingPrice * 0.50);
    const strikeMax = Math.ceil(underlyingPrice * 1.50);

    // Use the options chain snapshot endpoint
    const chainUrl = `https://api.polygon.io/v3/snapshot/options/${upperSymbol}?contract_type=${contractType}&strike_price.gte=${strikeMin}&strike_price.lte=${strikeMax}&limit=250&apiKey=${POLYGON_API_KEY}`;

    console.log(`Fetching options chain from Polygon`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    let chainRes;
    try {
      chainRes = await fetch(chainUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return new Response(
          JSON.stringify({ error: 'Request timed out. Please try again.' }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw fetchError;
    }

    if (!chainRes.ok) {
      const body = await chainRes.text();
      console.error(`Options chain failed: ${chainRes.status} ${body}`);
      return new Response(
        JSON.stringify({ error: `Unable to fetch options data for "${upperSymbol}". The symbol may not have options available.` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const chainData = await chainRes.json();
    const contracts = chainData.results || [];

    console.log(`Got ${contracts.length} option contracts from Polygon`);

    // Group by expiration
    const optionsByExpiration: Record<string, any[]> = {};

    for (const contract of contracts) {
      const details = contract.details;
      if (!details) continue;

      const expDate = details.expiration_date; // YYYY-MM-DD
      if (!expDate) continue;

      // Convert to unix timestamp key (matching existing frontend format)
      const timestamp = (new Date(expDate).getTime() / 1000).toString();

      if (!optionsByExpiration[timestamp]) {
        optionsByExpiration[timestamp] = [];
      }

      const quote = contract.last_quote || {};
      const trade = contract.last_trade || {};
      const greeks = contract.greeks || {};
      const day = contract.day || {};

      const bid = quote.bid || 0;
      const ask = quote.ask || 0;
      const strike = details.strike_price || 0;

      optionsByExpiration[timestamp].push({
        strike,
        bid,
        ask,
        mid: bid && ask ? (bid + ask) / 2 : trade.price || 0,
        volume: day.volume || 0,
        openInterest: contract.open_interest || 0,
        impliedVolatility: contract.implied_volatility || 0,
        delta: greeks.delta ? Math.abs(greeks.delta) : 0,
        inTheMoney: optionType === 'PUT' ? strike > underlyingPrice : strike < underlyingPrice,
        lastPrice: trade.price || 0,
      });
    }

    // Sort each expiration by strike descending and limit
    const MAX_EXPIRATIONS = 4;
    const sortedKeys = Object.keys(optionsByExpiration).sort((a, b) => Number(a) - Number(b)).slice(0, MAX_EXPIRATIONS);
    
    const finalOptions: Record<string, any[]> = {};
    for (const key of sortedKeys) {
      finalOptions[key] = optionsByExpiration[key].sort((a: any, b: any) => b.strike - a.strike).slice(0, 50);
      console.log(`Expiration ${new Date(Number(key) * 1000).toISOString().split('T')[0]}: ${finalOptions[key].length} options`);
    }

    const result = {
      symbol: upperSymbol,
      underlyingPrice,
      expirations: sortedKeys,
      options: finalOptions,
      timestamp: Date.now(),
    };

    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    console.log(`Cached options chain for ${upperSymbol}`);

    return new Response(
      JSON.stringify(result),
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
