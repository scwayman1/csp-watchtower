import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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

    // Enhanced regex patterns for different broker formats
    const patterns = [
      // Format: "SELL TO OPEN 10 ACVA 2025-11-28 5.00 PUT @ 0.35"
      /(?:STO|SELL\s+TO\s+OPEN|SOLD)\s+(?<contracts>\d+)?\s*(?:CONTRACTS?|CT|X)?\s*(?<symbol>[A-Z]{1,6})\s+(?<exp>(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|[A-Z]{3}\s+\d{1,2},?\s+\d{2,4}|\d{1,2}\s+[A-Z]{3}\s+\d{2,4}))\s+(?<strike>\d+(?:\.\d{1,2})?)\s*(?:PUT|P)\s*[@AT]*\s*(?<premium>\d+(?:\.\d{1,2})?)/i,
      
      // Format: "Sold 3 Contracts ACVA Nov 28 2025 5 Put @ 0.36"
      /SOLD\s+(?<contracts>\d+)\s+CONTRACTS?\s+(?<symbol>[A-Z]{1,6})\s+(?<exp>[A-Z]{3}\s+\d{1,2},?\s+\d{2,4})\s+(?<strike>\d+(?:\.\d{1,2})?)\s+PUT\s*[@AT]*\s*(?<premium>\d+(?:\.\d{1,2})?)/i,
      
      // Format: "STO ACVA 11/28/25 5P ×20 @0.34"
      /STO\s+(?<symbol>[A-Z]{1,6})\s+(?<exp>\d{1,2}\/\d{1,2}\/\d{2,4})\s+(?<strike>\d+(?:\.\d{1,2})?)P\s*[×X]\s*(?<contracts>\d+)\s*[@AT]*\s*(?<premium>\d+(?:\.\d{1,2})?)/i,
    ];

    let parsed = null;
    for (const pattern of patterns) {
      const match = orderText.match(pattern);
      if (match && match.groups) {
        parsed = match.groups;
        break;
      }
    }

    if (!parsed) {
      return new Response(
        JSON.stringify({ error: 'Could not parse order text. Please check format.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize expiration date
    let expiration: string;
    const expStr = parsed.exp;
    
    // Try different date formats
    if (/^\d{4}-\d{2}-\d{2}$/.test(expStr)) {
      expiration = expStr; // Already ISO format
    } else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(expStr)) {
      const [month, day, year] = expStr.split('/');
      const fullYear = year.length === 2 ? `20${year}` : year;
      expiration = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    } else {
      // Parse month name formats like "Nov 28 2025" or "28 Nov 2025"
      const date = new Date(expStr);
      if (!isNaN(date.getTime())) {
        expiration = date.toISOString().split('T')[0];
      } else {
        throw new Error('Invalid expiration date format');
      }
    }

    const result = {
      symbol: parsed.symbol.toUpperCase(),
      strike_price: parseFloat(parsed.strike),
      expiration,
      contracts: parsed.contracts ? parseInt(parsed.contracts) : 1,
      premium_per_contract: parseFloat(parsed.premium),
      raw_order_text: orderText,
    };

    console.log('Parsed order:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error parsing order:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to parse order';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});