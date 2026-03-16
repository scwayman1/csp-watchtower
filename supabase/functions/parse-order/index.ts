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
    const positions: any[] = [];
    const calls: any[] = [];

    const pushParsedOption = (optionType: string, parsedOption: any) => {
      if (optionType === 'PUT') {
        positions.push(parsedOption);
      } else {
        calls.push(parsedOption);
      }
    };

    const parseCsvLine = (line: string) => line.split(',').map((cell) => cell.trim());

    // CSV support (header and no-header variants)
    const csvLines = orderText
      .trim()
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);

    if (csvLines.length > 0) {
      const headerCells = parseCsvLine(csvLines[0]).map((cell) => cell.toLowerCase());
      const headerAliases: Record<string, string[]> = {
        symbol: ['symbol', 'ticker', 'underlying'],
        expiration: ['expiration', 'exp', 'expiry', 'date'],
        type: ['type', 'option_type', 'optiontype', 'cp'],
        strike: ['strike', 'strike_price', 'strikeprice'],
        action: ['action', 'side'],
        premium: ['premium', 'price', 'premium_per_contract', 'credit'],
        contracts: ['contracts', 'contract', 'qty', 'quantity'],
      };

      const headerIndexMap: Record<string, number> = {};
      for (const [field, aliases] of Object.entries(headerAliases)) {
        const idx = headerCells.findIndex((cell) => aliases.includes(cell));
        if (idx !== -1) {
          headerIndexMap[field] = idx;
        }
      }

      const hasHeaderRow = ['symbol', 'expiration', 'type', 'strike', 'premium', 'contracts']
        .every((field) => headerIndexMap[field] !== undefined);

      if (hasHeaderRow) {
        for (const rawLine of csvLines.slice(1)) {
          const row = parseCsvLine(rawLine);
          const symbol = row[headerIndexMap.symbol];
          const expiration = row[headerIndexMap.expiration];
          const rawType = row[headerIndexMap.type];
          const strike = row[headerIndexMap.strike];
          const action = row[headerIndexMap.action] ?? '';
          const premium = row[headerIndexMap.premium];
          const contracts = row[headerIndexMap.contracts];

          if (!symbol || !expiration || !rawType || !strike || !premium || !contracts) continue;
          if (action && !/^(sto|sell_to_open|sell to open|sold|sell)$/i.test(action)) continue;

          const normalizedType = rawType.toUpperCase() === 'P'
            ? 'PUT'
            : rawType.toUpperCase() === 'C'
              ? 'CALL'
              : rawType.toUpperCase();

          if (normalizedType !== 'PUT' && normalizedType !== 'CALL') continue;

          pushParsedOption(normalizedType, {
            symbol: symbol.toUpperCase(),
            strike,
            exp: expiration,
            premium,
            contracts,
          });
        }
      } else {
        // No-header CSV variants:
        // 1) SYMBOL,TYPE,ACTION,CONTRACTS,EXPIRATION,STRIKE,PREMIUM[,TOTAL]
        // 2) TICKER,EXPIRATION,TYPE,STRIKE,ACTION,PREMIUM,CONTRACTS
        for (const rawLine of csvLines) {
          const row = parseCsvLine(rawLine);
          if (row.length < 7) continue;

          const [c0, c1, c2, c3, c4, c5, c6] = row;

          // Variant 1
          if (/^[A-Z]{1,8}$/i.test(c0) && /^(PUT|CALL|P|C)$/i.test(c1) && /^(sto|sell_to_open|sell to open|sold|sell)$/i.test(c2) && /^\d+$/.test(c3) && /^\d{4}-\d{2}-\d{2}$/.test(c4)) {
            const optionType = c1.toUpperCase() === 'P' ? 'PUT' : c1.toUpperCase() === 'C' ? 'CALL' : c1.toUpperCase();
            pushParsedOption(optionType, {
              symbol: c0.toUpperCase(),
              strike: c5,
              exp: c4,
              premium: c6,
              contracts: c3,
            });
            continue;
          }

          // Variant 2
          if (/^[A-Z]{1,8}$/i.test(c0) && /^\d{4}-\d{2}-\d{2}$/.test(c1) && /^(PUT|CALL|P|C)$/i.test(c2) && /^(sto|sell_to_open|sell to open|sold|sell)$/i.test(c4)) {
            const optionType = c2.toUpperCase() === 'P' ? 'PUT' : c2.toUpperCase() === 'C' ? 'CALL' : c2.toUpperCase();
            pushParsedOption(optionType, {
              symbol: c0.toUpperCase(),
              strike: c3,
              exp: c1,
              premium: c5,
              contracts: c6,
            });
          }
        }
      }
    }

    // Legacy strict CSV fallback
    if (positions.length === 0 && calls.length === 0) {
      const csvPattern = /^([A-Z]{1,6}),\s*(PUT|CALL),\s*(SELL_TO_OPEN|STO|SOLD),\s*(\d+),\s*(\d{4}-\d{2}-\d{2}),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)(?:,\s*\d+(?:\.\d+)?)?$/i;

      for (const line of csvLines) {
        const m = line.trim().match(csvPattern);
        if (m) {
          const [, symbol, type, , contracts, exp, strike, premium] = m;
          pushParsedOption(type.toUpperCase(), {
            symbol: symbol.toUpperCase(),
            strike,
            exp,
            premium,
            contracts,
          });
        }
      }
    }
    
    // Format 0: Broker activity format (multi-line blocks)
    // Example:
    // CALL (AMZN) AMAZON.COM INC JAN 30 26 $245 (100 SHS)
    // Sell
    // 1/5/2026
    // Shares: -2
    // Price: $2.20
    // -$439.95
    const brokerActivityPattern = /(PUT|CALL)\s+\(([A-Z]+)\)[^\n]+([A-Z]{3})\s+(\d{1,2})\s+(\d{2})\s+\$(\d+(?:\.\d+)?)[^\n]*\n[^\n]*\n[^\n]*\nShares:\s*-?(\d+)\nPrice:\s*\$(\d+(?:\.\d+)?)/gi;
    
    let brokerMatch;
    while ((brokerMatch = brokerActivityPattern.exec(orderText)) !== null) {
      const [, optionType, symbol, monthStr, day, year, strike, contracts, premium] = brokerMatch;
      
      // Convert month name to number
      const monthMap: Record<string, string> = {
        'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04',
        'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
        'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
      };
      const month = monthMap[monthStr.toUpperCase()] || '01';
      const fullYear = '20' + year;
      
      const parsedOption = {
        symbol: symbol.toUpperCase(),
        strike,
        exp: `${fullYear}-${month}-${day.padStart(2, '0')}`,
        premium,
        contracts,
      };
      
      if (optionType.toUpperCase() === 'PUT') {
        positions.push(parsedOption);
      } else {
        calls.push(parsedOption);
      }
    }
    
    // Format 1: Human-readable format with em-dash separators
    // Example: QQQ Feb 27 2026 607P — Sell 1 @ 6.21 — net -620.98
    // Example: INTU Feb 27 2026 560C — Sell 1 @ 6.80 — net -679.98
    if (positions.length === 0 && calls.length === 0) {
      const humanReadablePattern = /([A-Z]{1,6})\s+([A-Z]{3})\s+(\d{1,2})\s+(\d{4})\s+(\d+(?:\.\d+)?)([PC])\s*[—–-]\s*Sell\s+(\d+)\s*[@]\s*(\d+(?:\.\d+)?)/gi;
      
      let hrMatch;
      while ((hrMatch = humanReadablePattern.exec(orderText)) !== null) {
        const [, symbol, monthStr, day, year, strike, optionType, contracts, premium] = hrMatch;
        
        const monthMap: Record<string, string> = {
          'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04',
          'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
          'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
        };
        const month = monthMap[monthStr.toUpperCase()] || '01';
        
        const parsedOption = {
          symbol: symbol.toUpperCase(),
          strike,
          exp: `${year}-${month}-${day.padStart(2, '0')}`,
          premium,
          contracts,
        };
        
        if (optionType.toUpperCase() === 'P') {
          positions.push(parsedOption);
        } else {
          calls.push(parsedOption);
        }
      }
    }
    
    // Format 2: Portfolio format (multi-line, possibly multiple positions)
    // Supports both PUTs and CALLs
    // Example PUT: UBER251128P87
    // Example CALL: UBER251128C87
    // Split by position blocks (each starts with a symbol pattern for PUT or CALL)
    if (positions.length === 0 && calls.length === 0) {
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

      // Format 4: Clean List format with OCC symbol and separate Contracts/Premium lines
      // Example: DDOG251226C172.5\nCALL — Datadog...\nContracts: -2\nPremium: $2.45
      if (positions.length === 0 && calls.length === 0) {
        const cleanListBlocks = orderText.split(/(?=^[A-Z]+\d{6}[PC]\d+)/gm).filter(b => b.trim());
        
        for (const block of cleanListBlocks) {
          const occMatch = block.match(/^([A-Z]+)(\d{6})([PC])(\d+(?:\.\d+)?)/);
          if (occMatch) {
            const [, symbol, dateStr, optionType, strike] = occMatch;
            
            // Extract contracts (look for "Contracts: -2" or "Contracts: 2")
            const contractsMatch = block.match(/Contracts:\s*-?(\d+)/i);
            // Extract premium (look for "Premium: $2.45" or "Premium: 2.45")
            const premiumMatch = block.match(/Premium:\s*\$?(\d+(?:\.\d+)?)/i);
            
            if (contractsMatch && premiumMatch) {
              const year = '20' + dateStr.substring(0, 2);
              const month = dateStr.substring(2, 4);
              const day = dateStr.substring(4, 6);
              
              const parsedOption = {
                symbol,
                strike,
                exp: `${year}-${month}-${day}`,
                premium: premiumMatch[1],
                contracts: contractsMatch[1],
              };
              
              if (optionType === 'P') {
                positions.push(parsedOption);
              } else {
                calls.push(parsedOption);
              }
            }
          }
        }
      }
      
      // Format 5: Generic OCC-style symbol blocks like "QQQ251128P605   1   6.4200"
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