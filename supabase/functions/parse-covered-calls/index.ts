import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderText } = await req.json();
    
    if (!orderText || typeof orderText !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid order text' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get authorization header to identify user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Parsing bulk covered calls for user:", user.id);

    // Parse multiple covered call orders
    const calls = [];
    
    // Try to detect format and parse accordingly
    // Format patterns for covered calls:
    // STO AAPL 01/17/2025 150C x2 @2.50
    // Sold 1 Contract TSLA Dec 20 2024 400 Call @ 5.00
    // AAPL250117C150 CALL ... $2.50 -2.000
    
    // Split into potential order blocks
    const lines = orderText.split('\n').filter(l => l.trim());
    
    for (const line of lines) {
      // Pattern 1: STO format
      const stoMatch = line.match(/(?:STO|SELL\s+TO\s+OPEN)\s+([A-Z]{1,6})\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d+(?:\.\d+)?)C\s*[xX×]\s*(\d+)\s*[@AT]*\s*(\d+(?:\.\d+)?)/i);
      if (stoMatch) {
        const [, symbol, exp, strike, contracts, premium] = stoMatch;
        calls.push({ symbol, exp, strike, contracts, premium });
        continue;
      }

      // Pattern 2: Sold format
      const soldMatch = line.match(/SOLD?\s+(\d+)\s+CONTRACTS?\s+([A-Z]{1,6})\s+([A-Z]{3}\s+\d{1,2},?\s+\d{2,4})\s+(\d+(?:\.\d+)?)\s+CALL\s*[@AT]*\s*(\d+(?:\.\d+)?)/i);
      if (soldMatch) {
        const [, contracts, symbol, exp, strike, premium] = soldMatch;
        calls.push({ symbol, exp, strike, contracts, premium });
        continue;
      }

      // Pattern 3: Portfolio format (AAPL250117C150)
      const portfolioMatch = line.match(/([A-Z]+)(\d{6})C(\d+(?:\.\d+)?)/);
      if (portfolioMatch) {
        const [, symbol, dateStr, strike] = portfolioMatch;
        // Look for price and quantity in subsequent context
        const priceMatch = orderText.match(new RegExp(`${portfolioMatch[0]}.*?\\$([\\d.]+).*?-(\\d+(?:\\.\\d+)?)`, 's'));
        if (priceMatch) {
          const [, premium, contracts] = priceMatch;
          const year = '20' + dateStr.substring(0, 2);
          const month = dateStr.substring(2, 4);
          const day = dateStr.substring(4, 6);
          calls.push({
            symbol,
            exp: `${year}-${month}-${day}`,
            strike,
            contracts: Math.abs(parseFloat(contracts)).toString(),
            premium
          });
        }
      }
    }

    if (calls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid covered call orders found in text' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Parsed ${calls.length} covered call order(s):`, calls);

    // Fetch user's assigned positions to match against
    const { data: assignedPositions, error: posError } = await supabase
      .from('assigned_positions')
      .select('id, symbol')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (posError) throw posError;

    if (!assignedPositions || assignedPositions.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No active assigned positions found. You must have assigned shares to sell covered calls.',
          inserted: 0,
          unmatched: calls.length
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a map of symbol -> assigned_position_id
    const symbolToPositionId = new Map(
      assignedPositions.map(p => [p.symbol.toUpperCase(), p.id])
    );

    console.log("Available assigned positions:", Array.from(symbolToPositionId.keys()));

    // Process each parsed call and match to assigned position
    let inserted = 0;
    let unmatched = 0;
    const callsToInsert = [];

    for (const call of calls) {
      const symbol = call.symbol.toUpperCase();
      const assignedPositionId = symbolToPositionId.get(symbol);

      if (!assignedPositionId) {
        console.log(`No assigned position found for ${symbol}`);
        unmatched++;
        continue;
      }

      // Normalize expiration date
      let expiration: string;
      const expStr = call.exp;
      
      if (/^\d{4}-\d{2}-\d{2}$/.test(expStr)) {
        expiration = expStr;
      } else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(expStr)) {
        const [month, day, year] = expStr.split('/');
        const fullYear = year.length === 2 ? `20${year}` : year;
        expiration = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      } else {
        const date = new Date(expStr);
        if (!isNaN(date.getTime())) {
          expiration = date.toISOString().split('T')[0];
        } else {
          console.log(`Invalid date format for ${symbol}: ${expStr}`);
          unmatched++;
          continue;
        }
      }

      callsToInsert.push({
        assigned_position_id: assignedPositionId,
        strike_price: parseFloat(call.strike),
        expiration,
        premium_per_contract: parseFloat(call.premium),
        contracts: parseInt(call.contracts) || 1,
        is_active: true
      });
    }

    // Insert all matched covered calls
    if (callsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('covered_calls')
        .insert(callsToInsert);

      if (insertError) {
        console.error("Insert error:", insertError);
        throw insertError;
      }

      inserted = callsToInsert.length;
      console.log(`Inserted ${inserted} covered calls`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        inserted, 
        unmatched,
        totalParsed: calls.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
