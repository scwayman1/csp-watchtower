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

    // Try to detect format and parse accordingly
    const positions = [];
    
    // Format 1: Portfolio format (multi-line, possibly multiple positions)
    // Example:
    // UBER251128P87
    // PUT (UBER) UBER TECHNOLOGIES NOV 28 25 $87 (100 SHS)
    // $0.55
    // -1.000
    // Split by position blocks (each starts with a symbol pattern)
    const portfolioBlocks = orderText.split(/(?=^[A-Z]+\d{6}P\d+)/gm).filter(b => b.trim());
    
    for (const block of portfolioBlocks) {
      const portfolioMatch = block.match(/^([A-Z]+)(\d{6})P(\d+(?:\.\d+)?)\s*\n.*?\n\$?([\d.]+)\s*\n-?([\d.]+)/m);
      if (portfolioMatch) {
        const [, symbol, dateStr, strike, premium, contracts] = portfolioMatch;
        
        // Parse date: YYMMDD format
        const year = '20' + dateStr.substring(0, 2);
        const month = dateStr.substring(2, 4);
        const day = dateStr.substring(4, 6);
        
        positions.push({
          symbol,
          strike,
          exp: `${year}-${month}-${day}`,
          premium,
          contracts: Math.abs(parseFloat(contracts)).toString(),
        });
      }
    }
    
    // Format 2: Standard broker formats (single position)
    if (positions.length === 0) {
      const patterns = [
        // Format: "SELL TO OPEN 10 ACVA 2025-11-28 5.00 PUT @ 0.35"
        /(?:STO|SELL\s+TO\s+OPEN|SOLD)\s+(?<contracts>\d+)?\s*(?:CONTRACTS?|CT|X)?\s*(?<symbol>[A-Z]{1,6})\s+(?<exp>(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|[A-Z]{3}\s+\d{1,2},?\s+\d{2,4}|\d{1,2}\s+[A-Z]{3}\s+\d{2,4}))\s+(?<strike>\d+(?:\.\d{1,2})?)\s*(?:PUT|P)\s*[@AT]*\s*(?<premium>\d+(?:\.\d{1,2})?)/i,
        
        // Format: "Sold 3 Contracts ACVA Nov 28 2025 5 Put @ 0.36"
        /SOLD\s+(?<contracts>\d+)\s+CONTRACTS?\s+(?<symbol>[A-Z]{1,6})\s+(?<exp>[A-Z]{3}\s+\d{1,2},?\s+\d{2,4})\s+(?<strike>\d+(?:\.\d{1,2})?)\s+PUT\s*[@AT]*\s*(?<premium>\d+(?:\.\d{1,2})?)/i,
        
        // Format: "STO ACVA 11/28/25 5P ×20 @0.34"
        /STO\s+(?<symbol>[A-Z]{1,6})\s+(?<exp>\d{1,2}\/\d{1,2}\/\d{2,4})\s+(?<strike>\d+(?:\.\d{1,2})?)P\s*[×X]\s*(?<contracts>\d+)\s*[@AT]*\s*(?<premium>\d+(?:\.\d{1,2})?)/i,
      ];

      for (const pattern of patterns) {
        const match = orderText.match(pattern);
        if (match && match.groups) {
          positions.push(match.groups);
          break;
        }
      }
    }

    if (positions.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Could not parse order text. Please check format.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process all positions
    const results = positions.map(parsed => {
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

      return {
        symbol: parsed.symbol.toUpperCase(),
        strike_price: parseFloat(parsed.strike),
        expiration,
        contracts: parsed.contracts ? parseInt(parsed.contracts) : 1,
        premium_per_contract: parseFloat(parsed.premium),
      };
    });

    console.log(`Parsed ${results.length} position(s):`, results);

    return new Response(
      JSON.stringify({ positions: results, raw_order_text: orderText }),
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