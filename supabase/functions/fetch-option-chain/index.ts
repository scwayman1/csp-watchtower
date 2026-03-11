import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 60 * 60 * 1000;

// Crumb/cookie cache
let crumbCache: { crumb: string; cookie: string; timestamp: number } | null = null;
const CRUMB_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

async function getCrumbAndCookie(): Promise<{ crumb: string; cookie: string }> {
  if (crumbCache && (Date.now() - crumbCache.timestamp < CRUMB_CACHE_DURATION)) {
    return { crumb: crumbCache.crumb, cookie: crumbCache.cookie };
  }

  // Step 1: Get cookie from Yahoo
  const consentRes = await fetch('https://fc.yahoo.com/', {
    redirect: 'manual',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    },
  });
  // Consume body
  await consentRes.text();

  const setCookies = consentRes.headers.get('set-cookie') || '';
  // Extract A1/A3 cookies
  const cookieMatch = setCookies.match(/A\d=[^;]+/);
  const cookie = cookieMatch ? cookieMatch[0] : '';

  if (!cookie) {
    // Fallback: try getting cookie from finance page
    const finRes = await fetch('https://finance.yahoo.com/', {
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
    });
    await finRes.text();
  }

  // Step 2: Get crumb using cookie
  const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Cookie': cookie,
    },
  });

  const crumb = await crumbRes.text();

  if (!crumb || crumb.includes('Too Many') || crumb.includes('<')) {
    throw new Error(`Failed to get crumb: ${crumb.substring(0, 100)}`);
  }

  crumbCache = { crumb, cookie, timestamp: Date.now() };
  console.log('Got Yahoo crumb successfully');
  return { crumb, cookie };
}

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

    // Step 1: Get underlying price via v8 chart (no crumb needed)
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${upperSymbol}?interval=1d&range=1d`;
    const chartRes = await fetch(chartUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!chartRes.ok) {
      await chartRes.text();
      return new Response(
        JSON.stringify({ error: `"${upperSymbol}" is not a valid ticker symbol.`, invalidSymbol: true }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const chartData = await chartRes.json();
    const chartResult = chartData?.chart?.result?.[0];
    const underlyingPrice = chartResult?.meta?.regularMarketPrice || 0;

    if (!underlyingPrice) {
      return new Response(
        JSON.stringify({ error: `"${upperSymbol}" is not a valid ticker symbol.`, invalidSymbol: true }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Underlying price for ${upperSymbol}: $${underlyingPrice}`);

    // Step 2: Get crumb+cookie for v7 options endpoint
    let crumb: string, cookie: string;
    try {
      const auth = await getCrumbAndCookie();
      crumb = auth.crumb;
      cookie = auth.cookie;
    } catch (err) {
      console.error('Failed to get Yahoo crumb:', err);
      // Return just the underlying price with empty options
      const fallbackResult = {
        symbol: upperSymbol,
        underlyingPrice,
        expirations: [],
        options: {},
        timestamp: Date.now(),
        error: 'Options data temporarily unavailable',
      };
      return new Response(
        JSON.stringify(fallbackResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Fetch options with crumb
    const baseUrl = `https://query1.finance.yahoo.com/v7/finance/options/${upperSymbol}?crumb=${encodeURIComponent(crumb)}`;

    const initialRes = await fetch(baseUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Cookie': cookie,
      },
    });

    if (!initialRes.ok) {
      const body = await initialRes.text();
      console.error(`Yahoo options failed: ${initialRes.status} ${body.substring(0, 200)}`);

      // If crumb expired, invalidate cache and retry once
      if (initialRes.status === 401) {
        crumbCache = null;
        try {
          const auth = await getCrumbAndCookie();
          const retryRes = await fetch(
            `https://query1.finance.yahoo.com/v7/finance/options/${upperSymbol}?crumb=${encodeURIComponent(auth.crumb)}`,
            {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Cookie': auth.cookie,
              },
            }
          );
          if (retryRes.ok) {
            // Continue with retry response below by reassigning
            const retryData = await retryRes.json();
            return processOptionsResponse(retryData, upperSymbol, underlyingPrice, optionType, cacheKey);
          }
          await retryRes.text();
        } catch {
          // Fall through to error
        }
      }

      return new Response(
        JSON.stringify({ error: `Unable to fetch options for "${upperSymbol}".` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const initialData = await initialRes.json();
    return processOptionsResponse(initialData, upperSymbol, underlyingPrice, optionType, cacheKey);
  } catch (error) {
    console.error('Error fetching option chain:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function processOptionsResponse(
  data: any,
  symbol: string,
  underlyingPrice: number,
  optionType: string,
  cacheKey: string
): Response {
  const result0 = data?.optionChain?.result?.[0];

  if (!result0) {
    return new Response(
      JSON.stringify({ error: `No options data for "${symbol}".` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const strikeMin = underlyingPrice * 0.50;
  const strikeMax = underlyingPrice * 1.50;

  const processOptions = (options: any[]): any[] => {
    const filtered: any[] = [];
    for (const opt of options) {
      const strike = opt.strike || 0;
      if (strike < strikeMin || strike > strikeMax) continue;
      const bid = opt.bid || 0;
      const ask = opt.ask || 0;
      filtered.push({
        strike,
        bid,
        ask,
        mid: bid && ask ? (bid + ask) / 2 : opt.lastPrice || 0,
        volume: opt.volume || 0,
        openInterest: opt.openInterest || 0,
        impliedVolatility: opt.impliedVolatility || 0,
        delta: 0,
        inTheMoney: opt.inTheMoney || false,
        lastPrice: opt.lastPrice || 0,
      });
    }
    return filtered.sort((a, b) => b.strike - a.strike).slice(0, 50);
  };

  const optionsByExpiration: Record<string, any[]> = {};

  // Process all expirations returned (Yahoo returns first exp by default)
  const allOptions = result0.options || [];
  for (const expBlock of allOptions) {
    const expTs = String(expBlock.expirationDate);
    const rawOpts = optionType === 'PUT' ? (expBlock.puts || []) : (expBlock.calls || []);
    const processed = processOptions(rawOpts);
    if (processed.length > 0) {
      optionsByExpiration[expTs] = processed;
    }
  }

  // Also include expiration dates list for frontend
  const allExpirations = result0.expirationDates || [];

  const sortedKeys = Object.keys(optionsByExpiration).sort((a, b) => Number(a) - Number(b));

  const response = {
    symbol,
    underlyingPrice,
    expirations: sortedKeys.length > 0 ? sortedKeys : allExpirations.map(String),
    options: optionsByExpiration,
    timestamp: Date.now(),
  };

  cache.set(cacheKey, { data: response, timestamp: Date.now() });
  console.log(`Cached options for ${symbol} (${sortedKeys.length} expirations, ${Object.values(optionsByExpiration).reduce((s, a) => s + a.length, 0)} contracts)`);

  return new Response(
    JSON.stringify(response),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
