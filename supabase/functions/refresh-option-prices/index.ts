import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const POLYGON_API_KEY = Deno.env.get('POLYGON_API_KEY');
const REQUEST_DELAY = 300;

interface PositionInfo {
  id: string;
  symbol: string;
  strike_price: number;
  expiration: string;
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Build Polygon option ticker: O:AAPL250321P00150000
function buildPolygonOptionTicker(symbol: string, expiration: string, strike: number, optionType: 'P' | 'C'): string {
  const expDate = new Date(expiration);
  const yy = String(expDate.getFullYear()).slice(-2);
  const mm = String(expDate.getMonth() + 1).padStart(2, '0');
  const dd = String(expDate.getDate()).padStart(2, '0');
  const strikeInt = Math.round(strike * 1000);
  const strikeStr = String(strikeInt).padStart(8, '0');
  return `O:${symbol.toUpperCase()}${yy}${mm}${dd}${optionType}${strikeStr}`;
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
      // No body - fetch all active positions
    }

    let query = supabase
      .from('positions')
      .select('id, symbol, strike_price, expiration')
      .eq('is_active', true);

    if (positionIds && positionIds.length > 0) {
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

    if (!positions || positions.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active positions to refresh', updated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!POLYGON_API_KEY) {
      console.error('POLYGON_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Market data service not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Refreshing option prices for ${positions.length} positions`);

    const optionDataUpdates: any[] = [];

    // Process in batches of 5
    const BATCH_SIZE = 5;
    for (let i = 0; i < positions.length; i += BATCH_SIZE) {
      const batch = positions.slice(i, i + BATCH_SIZE);

      const batchPromises = batch.map(async (pos: any) => {
        const ticker = buildPolygonOptionTicker(pos.symbol, pos.expiration, pos.strike_price, 'P');
        const url = `https://api.polygon.io/v3/snapshot/options/${pos.symbol.toUpperCase()}?contract_type=put&strike_price=${pos.strike_price}&expiration_date=${pos.expiration}&limit=1&apiKey=${POLYGON_API_KEY}`;

        try {
          const res = await fetch(url);
          if (!res.ok) {
            console.error(`Failed for ${pos.symbol} $${pos.strike_price}: ${res.status}`);
            await res.text();
            return;
          }

          const data = await res.json();
          const contracts = data.results || [];

          // Find exact strike match
          const match = contracts.find((c: any) =>
            c.details && Math.abs(c.details.strike_price - pos.strike_price) < 0.01
          );

          if (match) {
            const quote = match.last_quote || {};
            const greeks = match.greeks || {};
            const bid = quote.bid || 0;
            const ask = quote.ask || 0;
            const mark = bid && ask ? (bid + ask) / 2 : (match.last_trade?.price || 0);

            optionDataUpdates.push({
              position_id: pos.id,
              bid_price: bid,
              ask_price: ask,
              mark_price: mark,
              delta: greeks.delta ? Math.abs(greeks.delta) : null,
              implied_volatility: match.implied_volatility || null,
              last_updated: new Date().toISOString(),
            });

            console.log(`${pos.symbol} $${pos.strike_price}: bid=${bid}, ask=${ask}, mark=${mark}`);
          } else {
            console.log(`No match for ${pos.symbol} $${pos.strike_price} exp ${pos.expiration}`);
          }
        } catch (error) {
          console.error(`Error for ${pos.symbol}:`, error);
        }
      });

      await Promise.all(batchPromises);
      if (i + BATCH_SIZE < positions.length) {
        await delay(REQUEST_DELAY);
      }
    }

    if (optionDataUpdates.length > 0) {
      const { error: upsertError } = await supabase
        .from('option_data')
        .upsert(optionDataUpdates, {
          onConflict: 'position_id',
          ignoreDuplicates: false
        });

      if (upsertError) {
        console.error('Error upserting option data:', upsertError);
        return new Response(
          JSON.stringify({ error: 'Failed to save option data', details: upsertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`Updated option prices for ${optionDataUpdates.length}/${positions.length} positions`);

    return new Response(
      JSON.stringify({
        message: 'Option prices refreshed',
        updated: optionDataUpdates.length,
        total: positions.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error refreshing option prices:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
