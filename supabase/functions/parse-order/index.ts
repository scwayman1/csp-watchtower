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
    const calls = [];
    
    // Format 1: Portfolio format (multi-line, possibly multiple positions)
    // Supports both PUTs and CALLs
    // Example PUT: UBER251128P87
    // Example CALL: UBER251128C87
    // Split by position blocks (each starts with a symbol pattern for PUT or CALL)
    const portfolioBlocks = orderText.split(/(?=^[A-Z]+\d{6}[PC]\d+)/gm).filter(b => b.trim());
    
    for (const block of portfolioBlocks) {
      // Match both PUT and CALL
      const portfolioMatch = block.match(/^([A-Z]+)(\d{6})([PC])(\d+(?:\.\d+)?)\s*\n.*?\n\$?([\d.]+)\s*\n-?([\d.]+)/m);
      if (portfolioMatch) {
        const [, symbol, dateStr, optionType, strike, premium, contracts] = portfolioMatch;
        
        // Parse date: YYMMDD format
        const year = '20' + dateStr.substring(0, 2);
        const month = dateStr.substring(2, 4);
        const day = dateStr.substring(4, 6);
        
        const parsedOption = {
          symbol,
          strike,
          exp: `${year}-${month}-${day}`,
          premium,
          contracts: Math.abs(parseFloat(contracts)).toString(),
        };
        
        if (optionType === 'P') {
          positions.push(parsedOption);
        } else {
          calls.push(parsedOption);
        }
      }
    }
    
    // Format 2: Standard broker formats (single position)
    if (positions.length === 0 && calls.length === 0) {
      const patterns = [
        // Format: "SELL TO OPEN 10 ACVA 2025-11-28 5.00 PUT @ 0.35"
        { regex: /(?:STO|SELL\s+TO\s+OPEN|SOLD)\s+(?<contracts>\d+)?\s*(?:CONTRACTS?|CT|X)?\s*(?<symbol>[A-Z]{1,6})\s+(?<exp>(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|[A-Z]{3}\s+\d{1,2},?\s+\d{2,4}|\d{1,2}\s+[A-Z]{3}\s+\d{2,4}))\s+(?<strike>\d+(?:\.\d{1,2})?)\s*(?:PUT|P)\s*[@AT]*\s*(?<premium>\d+(?:\.\d{1,2})?)/i, type: 'put' },
        { regex: /(?:STO|SELL\s+TO\s+OPEN|SOLD)\s+(?<contracts>\d+)?\s*(?:CONTRACTS?|CT|X)?\s*(?<symbol>[A-Z]{1,6})\s+(?<exp>(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|[A-Z]{3}\s+\d{1,2},?\s+\d{2,4}|\d{1,2}\s+[A-Z]{3}\s+\d{2,4}))\s+(?<strike>\d+(?:\.\d{1,2})?)\s*(?:CALL|C)\s*[@AT]*\s*(?<premium>\d+(?:\.\d{1,2})?)/i, type: 'call' },
        
        // Format: "Sold 3 Contracts ACVA Nov 28 2025 5 Put @ 0.36"
        { regex: /SOLD\s+(?<contracts>\d+)\s+CONTRACTS?\s+(?<symbol>[A-Z]{1,6})\s+(?<exp>[A-Z]{3}\s+\d{1,2},?\s+\d{2,4})\s+(?<strike>\d+(?:\.\d{1,2})?)\s+PUT\s*[@AT]*\s*(?<premium>\d+(?:\.\d{1,2})?)/i, type: 'put' },
        { regex: /SOLD\s+(?<contracts>\d+)\s+CONTRACTS?\s+(?<symbol>[A-Z]{1,6})\s+(?<exp>[A-Z]{3}\s+\d{1,2},?\s+\d{2,4})\s+(?<strike>\d+(?:\.\d{1,2})?)\s+CALL\s*[@AT]*\s*(?<premium>\d+(?:\.\d{1,2})?)/i, type: 'call' },
        
        // Format: "STO ACVA 11/28/25 5P ×20 @0.34"
        { regex: /STO\s+(?<symbol>[A-Z]{1,6})\s+(?<exp>\d{1,2}\/\d{1,2}\/\d{2,4})\s+(?<strike>\d+(?:\.\d{1,2})?)P\s*[×X]\s*(?<contracts>\d+)\s*[@AT]*\s*(?<premium>\d+(?:\.\d{1,2})?)/i, type: 'put' },
        { regex: /STO\s+(?<symbol>[A-Z]{1,6})\s+(?<exp>\d{1,2}\/\d{1,2}\/\d{2,4})\s+(?<strike>\d+(?:\.\d{1,2})?)C\s*[×X]\s*(?<contracts>\d+)\s*[@AT]*\s*(?<premium>\d+(?:\.\d{1,2})?)/i, type: 'call' },
      ];

      for (const { regex, type } of patterns) {
        const match = orderText.match(regex);
        if (match && match.groups) {
          if (type === 'put') {
            positions.push(match.groups);
          } else {
            calls.push(match.groups);
          }
          break;
        }
      }

      // Format 3: Thrivent multi-position trade confirmation ("YOU SOLD" lines)
      if (positions.length === 0 && calls.length === 0) {
        const thriventPutPattern = /YOU\s+SOLD\s+\d{1,2}-\d{2}-\d{2}\s+\d{1,2}-\d{2}-\d{2}\s+([A-Z]+)(\d{6})P(\d+(?:\.\d+)?)[\s]+(\d+)[\s]+(\d+(?:\.\d+)?)/g;
        const thriventCallPattern = /YOU\s+SOLD\s+\d{1,2}-\d{2}-\d{2}\s+\d{1,2}-\d{2}-\d{2}\s+([A-Z]+)(\d{6})C(\d+(?:\.\d+)?)[\s]+(\d+)[\s]+(\d+(?:\.\d+)?)/g;
        let m: RegExpExecArray | null;
        
        while ((m = thriventPutPattern.exec(orderText)) !== null) {
          const [, symbol, dateStr, strike, contracts, premium] = m;
          const year = '20' + dateStr.substring(0, 2);
          const month = dateStr.substring(2, 4);
          const day = dateStr.substring(4, 6);

          positions.push({
            symbol,
            strike,
            exp: `${year}-${month}-${day}`,
            premium,
            contracts,
          });
        }
        
        while ((m = thriventCallPattern.exec(orderText)) !== null) {
          const [, symbol, dateStr, strike, contracts, premium] = m;
          const year = '20' + dateStr.substring(0, 2);
          const month = dateStr.substring(2, 4);
          const day = dateStr.substring(4, 6);

          calls.push({
            symbol,
            strike,
            exp: `${year}-${month}-${day}`,
            premium,
            contracts,
          });
        }
      }

      // Format 4: Generic OCC-style symbol blocks like "QQQ251128P605   1   6.4200"
      if (positions.length === 0 && calls.length === 0) {
        const genericPutPattern = /([A-Z]{1,6})(\d{6})P(\d+(?:\.\d+)?)[\s]+(\d+)[\s]+(\d+(?:\.\d+)?)/g;
        const genericCallPattern = /([A-Z]{1,6})(\d{6})C(\d+(?:\.\d+)?)[\s]+(\d+)[\s]+(\d+(?:\.\d+)?)/g;
        let m: RegExpExecArray | null;

        while ((m = genericPutPattern.exec(orderText)) !== null) {
          const [, symbol, dateStr, strike, contracts, premium] = m;
          const year = '20' + dateStr.substring(0, 2);
          const month = dateStr.substring(2, 4);
          const day = dateStr.substring(4, 6);

          positions.push({
            symbol,
            strike,
            exp: `${year}-${month}-${day}`,
            premium,
            contracts,
          });
        }
        
        while ((m = genericCallPattern.exec(orderText)) !== null) {
          const [, symbol, dateStr, strike, contracts, premium] = m;
          const year = '20' + dateStr.substring(0, 2);
          const month = dateStr.substring(2, 4);
          const day = dateStr.substring(4, 6);

          calls.push({
            symbol,
            strike,
            exp: `${year}-${month}-${day}`,
            premium,
            contracts,
          });
        }
      }
    }

    if (positions.length === 0 && calls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Could not parse order text. Please check format.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process all positions (PUTs)
    const putResults = positions.map(parsed => {
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
    
    // Process all calls (CALLs)
    const callResults = calls.map(parsed => {
      // Normalize expiration date
      let expiration: string;
      const expStr = parsed.exp;
      
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

    console.log(`Parsed ${putResults.length} PUT(s) and ${callResults.length} CALL(s)`);

    return new Response(
      JSON.stringify({ 
        puts: putResults, 
        calls: callResults,
        raw_order_text: orderText 
      }),
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