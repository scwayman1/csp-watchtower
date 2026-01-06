import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FINNHUB_API_KEY = Deno.env.get('FINNHUB_API_KEY');
const REQUEST_DELAY = 300; // 300ms between requests to avoid rate limiting

interface PositionInfo {
  id: string;
  symbol: string;
  strike_price: number;
  expiration: string;
}

// Format date as YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Build option symbol in OCC format: SYMBOL + YY + MM + DD + P/C + Strike (8 digits with 3 decimal places)
function buildOptionSymbol(symbol: string, expiration: string, strike: number, optionType: 'P' | 'C'): string {
  const expDate = new Date(expiration);
  const yy = String(expDate.getFullYear()).slice(-2);
  const mm = String(expDate.getMonth() + 1).padStart(2, '0');
  const dd = String(expDate.getDate()).padStart(2, '0');
  
  // Strike price: multiply by 1000 and pad to 8 digits
  const strikeInt = Math.round(strike * 1000);
  const strikeStr = String(strikeInt).padStart(8, '0');
  
  // Pad symbol to 6 characters
  const paddedSymbol = symbol.toUpperCase().padEnd(6, ' ');
  
  return `${paddedSymbol}${yy}${mm}${dd}${optionType}${strikeStr}`;
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

    // Get optional position IDs from request body
    let positionIds: string[] | undefined;
    try {
      const body = await req.json();
      positionIds = body.positionIds;
    } catch {
      // No body is fine, we'll fetch all active positions
    }

    // Fetch active positions
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

    if (!FINNHUB_API_KEY) {
      console.error('FINNHUB_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Market data service not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Refreshing option prices for ${positions.length} positions`);

    // Group positions by symbol and expiration to minimize API calls
    const positionGroups = new Map<string, PositionInfo[]>();
    for (const pos of positions) {
      const key = `${pos.symbol}_${pos.expiration}`;
      if (!positionGroups.has(key)) {
        positionGroups.set(key, []);
      }
      positionGroups.get(key)!.push(pos as PositionInfo);
    }

    const optionDataUpdates: any[] = [];
    let processedCount = 0;

    for (const [key, groupPositions] of positionGroups) {
      const symbol = groupPositions[0].symbol;
      const expiration = groupPositions[0].expiration;
      
      try {
        // Fetch option chain for this symbol/expiration
        const optionsUrl = `https://finnhub.io/api/v1/stock/option-chain?symbol=${symbol}&date=${expiration}&token=${FINNHUB_API_KEY}`;
        
        const response = await fetch(optionsUrl);
        
        if (!response.ok) {
          console.error(`Failed to fetch options for ${symbol}: ${response.status}`);
          await delay(REQUEST_DELAY);
          continue;
        }

        const optionsData = await response.json();
        
        // Find matching options for each position's strike
        if (optionsData.data && optionsData.data.length > 0) {
          for (const pos of groupPositions) {
            // Look through all expirations returned to find our specific one
            for (const expData of optionsData.data) {
              if (expData.expirationDate !== expiration) continue;
              
              // Search in PUT options (we're tracking CSPs)
              const putOptions = expData.options?.PUT || [];
              const matchingOption = putOptions.find((opt: any) => 
                Math.abs(opt.strike - pos.strike_price) < 0.01
              );

              if (matchingOption) {
                const bid = matchingOption.bid || 0;
                const ask = matchingOption.ask || 0;
                const mark = bid && ask ? (bid + ask) / 2 : matchingOption.lastTradePrice || 0;
                
                optionDataUpdates.push({
                  position_id: pos.id,
                  bid_price: bid,
                  ask_price: ask,
                  mark_price: mark,
                  delta: matchingOption.delta ? Math.abs(matchingOption.delta) : null,
                  implied_volatility: matchingOption.impliedVolatility || null,
                  last_updated: new Date().toISOString(),
                });
                
                console.log(`Found option data for ${symbol} $${pos.strike_price}: bid=${bid}, ask=${ask}, mark=${mark}`);
                processedCount++;
              } else {
                console.log(`No matching option found for ${symbol} $${pos.strike_price} exp ${expiration}`);
              }
            }
          }
        }
        
        await delay(REQUEST_DELAY);
      } catch (error) {
        console.error(`Error fetching options for ${symbol}:`, error);
        await delay(REQUEST_DELAY);
      }
    }

    // Upsert option data
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

    console.log(`Successfully updated option prices for ${optionDataUpdates.length} positions`);

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
