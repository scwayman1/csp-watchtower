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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if specific symbols were provided in the request
    let requestedSymbols: string[] = [];
    try {
      const body = await req.json();
      if (body.symbols && Array.isArray(body.symbols)) {
        requestedSymbols = body.symbols;
        console.log('Received request for specific symbols:', requestedSymbols);
      }
    } catch {
      // No body or invalid JSON - that's fine, we'll fetch from positions
    }

    let symbols: string[] = [];

    if (requestedSymbols.length > 0) {
      // Use the symbols provided in the request
      symbols = requestedSymbols;
    } else {
      // Get all active positions and assigned positions to find symbols we need prices for
      const { data: positions, error: positionsError } = await supabase
        .from('positions')
        .select('symbol')
        .eq('is_active', true);

      if (positionsError) throw positionsError;

      const { data: assignedPositions, error: assignedError } = await supabase
        .from('assigned_positions')
        .select('symbol')
        .eq('is_active', true);

      if (assignedError) throw assignedError;

      const symbolsSet = new Set<string>();
      (positions || []).forEach((p: { symbol: string }) => symbolsSet.add(p.symbol));
      (assignedPositions || []).forEach((p: { symbol: string }) => symbolsSet.add(p.symbol));
      symbols = [...symbolsSet];
    }
    
    if (symbols.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active symbols to update' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch prices from Yahoo Finance API (free, no API key needed)
    // Process in smaller batches to avoid timeouts
    const BATCH_SIZE = 5;
    const DELAY_BETWEEN_REQUESTS = 300;
    const priceUpdates: any[] = [];
    
    const fetchSymbolData = async (symbol: string) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const quoteResponse = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=5m&range=1d`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            signal: controller.signal
          }
        );
        
        clearTimeout(timeoutId);
        
        if (!quoteResponse.ok) {
          console.error(`Failed to fetch data for ${symbol}: HTTP ${quoteResponse.status}`);
          return null;
        }

        const contentType = quoteResponse.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.error(`Non-JSON response for ${symbol}: ${contentType}`);
          return null;
        }
        
        const quoteData = await quoteResponse.json();
        const result = quoteData.chart?.result?.[0];
        
        if (result && result.indicators?.quote?.[0]) {
          const quote = result.indicators.quote[0];
          const timestamps = result.timestamp || [];
          const closes = quote.close || [];
          const opens = quote.open || [];
          
          const validPrices = closes
            .map((price: number | null, idx: number) => ({ price, time: timestamps[idx] }))
            .filter((item: any) => item.price !== null);
          
          if (validPrices.length > 0) {
            const currentPrice = validPrices[validPrices.length - 1].price;
            const explicitOpen = opens[0];
            const firstClose = validPrices[0].price;
            const dayOpen = explicitOpen ?? firstClose;
            const dayChangePct = ((currentPrice - dayOpen) / dayOpen) * 100;
            
            console.log(`${symbol}: price=${currentPrice?.toFixed(2)}, change=${dayChangePct?.toFixed(2)}%`);
            
            const step = Math.max(1, Math.ceil(validPrices.length / 20));
            const intradayPrices = validPrices
              .filter((_: any, idx: number) => idx % step === 0)
              .map((item: any) => item.price);
            
            return {
              symbol,
              underlying_price: currentPrice,
              day_open: dayOpen,
              day_change_pct: dayChangePct,
              intraday_prices: intradayPrices,
              last_updated: new Date().toISOString(),
            };
          }
        }
        return null;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.error(`Timeout fetching ${symbol}`);
        } else {
          console.error(`Error fetching ${symbol}:`, error);
        }
        return null;
      }
    };

    // Process symbols in batches
    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      const batch = symbols.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(fetchSymbolData));
      priceUpdates.push(...results.filter(r => r !== null));
      
      // Small delay between batches
      if (i + BATCH_SIZE < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
      }
    }

    const validUpdates = priceUpdates.filter(u => u !== null);

    if (validUpdates.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No price data available' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upsert market data
    const { error: upsertError } = await supabase
      .from('market_data')
      .upsert(validUpdates, { onConflict: 'symbol' });

    if (upsertError) throw upsertError;

    return new Response(
      JSON.stringify({ 
        message: 'Market data updated successfully',
        updated: validUpdates.length,
        symbols: validUpdates.map(u => u.symbol)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error refreshing market data:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
