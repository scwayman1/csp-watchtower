import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const REQUEST_DELAY = 300;

// Crumb/cookie cache
let crumbCache: { crumb: string; cookie: string; timestamp: number } | null = null;
const CRUMB_CACHE_DURATION = 30 * 60 * 1000;

async function getCrumbAndCookie(): Promise<{ crumb: string; cookie: string }> {
  if (crumbCache && (Date.now() - crumbCache.timestamp < CRUMB_CACHE_DURATION)) {
    return { crumb: crumbCache.crumb, cookie: crumbCache.cookie };
  }

  const consentRes = await fetch('https://fc.yahoo.com/', {
    redirect: 'manual',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    },
  });
  await consentRes.text();

  const setCookies = consentRes.headers.get('set-cookie') || '';
  const cookieMatch = setCookies.match(/A\d=[^;]+/);
  const cookie = cookieMatch ? cookieMatch[0] : '';

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
  return { crumb, cookie };
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let positionIds: string[] | undefined;
    try {
      const body = await req.json();
      positionIds = body.positionIds;
    } catch {
      // No body
    }

    let query = supabase
      .from('positions')
      .select('id, symbol, strike_price, expiration')
      .eq('is_active', true);

    if (positionIds?.length) {
      query = query.in('id', positionIds);
    }

    const { data: positions, error: posError } = await query;

    if (posError) {
      console.error('Error fetching positions:', posError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch positions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!positions?.length) {
      return new Response(
        JSON.stringify({ message: 'No active positions to refresh', updated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Refreshing option prices for ${positions.length} positions`);

    // Get Yahoo crumb with retry on failure
    let crumb: string, cookie: string;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (attempt > 0) {
          // Invalidate cache on retry
          crumbCache = null;
          await delay(1000 * attempt);
        }
        const auth = await getCrumbAndCookie();
        crumb = auth.crumb;
        cookie = auth.cookie;
        break;
      } catch (err) {
        console.error(`Crumb attempt ${attempt + 1}/3 failed:`, err);
        if (attempt === 2) {
          return new Response(
            JSON.stringify({ error: 'Market data authentication failed' }),
            { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Group by symbol+expiration
    const groups = new Map<string, any[]>();
    for (const pos of positions) {
      const key = `${pos.symbol}_${pos.expiration}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(pos);
    }

    const optionDataUpdates: any[] = [];

    for (const [key, groupPositions] of groups) {
      const symbol = groupPositions[0].symbol;
      const expiration = groupPositions[0].expiration;

      try {
        const expUnix = Math.floor(new Date(expiration).getTime() / 1000);
        const url = `https://query1.finance.yahoo.com/v7/finance/options/${symbol}?date=${expUnix}&crumb=${encodeURIComponent(crumb)}`;

        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Cookie': cookie,
          },
        });

        if (!res.ok) {
          console.error(`Failed for ${symbol}: ${res.status}`);
          await res.text();
          await delay(REQUEST_DELAY);
          continue;
        }

        const data = await res.json();
        const options = data?.optionChain?.result?.[0]?.options?.[0];

        if (options) {
          const puts = options.puts || [];

          for (const pos of groupPositions) {
            const match = puts.find((p: any) => Math.abs(p.strike - pos.strike_price) < 0.01);

            if (match) {
              const bid = match.bid || 0;
              const ask = match.ask || 0;
              const mark = bid && ask ? (bid + ask) / 2 : match.lastPrice || 0;

              optionDataUpdates.push({
                position_id: pos.id,
                bid_price: bid,
                ask_price: ask,
                mark_price: mark,
                delta: null,
                implied_volatility: match.impliedVolatility || null,
                last_updated: new Date().toISOString(),
              });

              console.log(`${symbol} $${pos.strike_price}: bid=${bid}, ask=${ask}, mark=${mark}`);
            }
          }
        }

        await delay(REQUEST_DELAY);
      } catch (error) {
        console.error(`Error for ${key}:`, error);
        await delay(REQUEST_DELAY);
      }
    }

    if (optionDataUpdates.length > 0) {
      const { error: upsertError } = await supabase
        .from('option_data')
        .upsert(optionDataUpdates, {
          onConflict: 'position_id',
          ignoreDuplicates: false,
        });

      if (upsertError) {
        console.error('Error upserting:', upsertError);
        return new Response(
          JSON.stringify({ error: 'Failed to save option data' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`Updated ${optionDataUpdates.length}/${positions.length} positions`);

    return new Response(
      JSON.stringify({
        message: 'Option prices refreshed',
        updated: optionDataUpdates.length,
        total: positions.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
