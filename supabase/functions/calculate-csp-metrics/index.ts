import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Trade {
  symbol: string;
  underlying: string;
  side: 'SELL_TO_OPEN' | 'BUY_TO_CLOSE' | 'ASSIGNMENT' | 'EXPIRATION';
  option_style: 'PUT' | 'CALL';
  contracts: number;
  price_per_contract: number;
  settlement_amount: number;
  fees: number;
  trade_date: string;
  settlement_date: string;
  strike_price?: number;
}

interface PositionSummary {
  symbol: string;
  underlying: string;
  status: 'OPEN' | 'CLOSED';
  open_contracts: number;
  total_premium_collected: number;
  collateral: number | null;
  notes: string | null;
}

interface MetricsSummary {
  total_csp_premium: number | null;
  total_collateral_csp: number | null;
  csp_yield: number | null;
  annualized_csp_yield: number | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { trades } = await req.json() as { trades: Trade[] };

    if (!Array.isArray(trades) || trades.length === 0) {
      return new Response(
        JSON.stringify({ error: 'trades array is required and must not be empty' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const notes: string[] = [];
    
    // Calculate total CSP premium (only SELL_TO_OPEN PUTs)
    const cspTrades = trades.filter(t => t.side === 'SELL_TO_OPEN' && t.option_style === 'PUT');
    const totalCspPremium = cspTrades.reduce((sum, t) => {
      const premium = -1 * (t.settlement_amount || 0);
      return sum + premium;
    }, 0);

    // Group trades by symbol to determine position status
    const positionMap = new Map<string, Trade[]>();
    trades.forEach(trade => {
      const existing = positionMap.get(trade.symbol) || [];
      positionMap.set(trade.symbol, [...existing, trade]);
    });

    const perSymbol: PositionSummary[] = [];
    let totalCollateral = 0;
    let hasNullCollateral = false;

    positionMap.forEach((symbolTrades, symbol) => {
      const underlying = symbolTrades[0].underlying;
      
      // Calculate net contracts
      let netContracts = 0;
      symbolTrades.forEach(trade => {
        if (trade.side === 'SELL_TO_OPEN') {
          netContracts += Math.abs(trade.contracts);
        } else if (trade.side === 'BUY_TO_CLOSE' || trade.side === 'ASSIGNMENT' || trade.side === 'EXPIRATION') {
          netContracts -= Math.abs(trade.contracts);
        }
      });

      const status: 'OPEN' | 'CLOSED' = netContracts > 0 ? 'OPEN' : 'CLOSED';
      
      // Calculate premium collected for this symbol (only SELL_TO_OPEN PUTs)
      const symbolCspTrades = symbolTrades.filter(t => t.side === 'SELL_TO_OPEN' && t.option_style === 'PUT');
      const premiumCollected = symbolCspTrades.reduce((sum, t) => {
        return sum + (-1 * (t.settlement_amount || 0));
      }, 0);

      // Calculate collateral if position is open
      let collateral: number | null = null;
      let positionNotes: string | null = null;

      if (status === 'OPEN' && netContracts > 0) {
        // Try to get strike price from the most recent SELL_TO_OPEN trade
        const openTrade = symbolTrades.find(t => t.side === 'SELL_TO_OPEN' && t.strike_price);
        
        if (openTrade && openTrade.strike_price) {
          collateral = openTrade.strike_price * 100 * netContracts;
          totalCollateral += collateral;
        } else {
          hasNullCollateral = true;
          positionNotes = 'Strike price not provided; cannot calculate collateral';
          notes.push(`${symbol}: ${positionNotes}`);
        }
      }

      perSymbol.push({
        symbol,
        underlying,
        status,
        open_contracts: netContracts,
        total_premium_collected: Number(premiumCollected.toFixed(2)),
        collateral,
        notes: positionNotes
      });
    });

    // Calculate yield metrics
    let cspYield: number | null = null;
    let annualizedCspYield: number | null = null;

    if (totalCollateral > 0 && !hasNullCollateral) {
      cspYield = totalCspPremium / totalCollateral;

      // Calculate days in period
      const tradeDates = trades.map(t => new Date(t.trade_date).getTime());
      const minDate = Math.min(...tradeDates);
      const maxDate = Math.max(...tradeDates);
      const daysInPeriod = Math.max(1, Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)));

      if (daysInPeriod > 0) {
        annualizedCspYield = cspYield * (365 / daysInPeriod);
      } else {
        notes.push('days_in_period <= 0; cannot calculate annualized yield');
      }
    } else if (hasNullCollateral) {
      notes.push('Some positions missing strike price; yield calculations set to null');
    } else if (totalCollateral === 0) {
      notes.push('No collateral at risk (no open positions); yield calculations set to null');
    }

    const summary: MetricsSummary = {
      total_csp_premium: Number(totalCspPremium.toFixed(2)),
      total_collateral_csp: totalCollateral > 0 ? Number(totalCollateral.toFixed(2)) : null,
      csp_yield: cspYield !== null ? Number(cspYield.toFixed(4)) : null,
      annualized_csp_yield: annualizedCspYield !== null ? Number(annualizedCspYield.toFixed(4)) : null,
    };

    return new Response(
      JSON.stringify({
        summary,
        per_symbol: perSymbol,
        notes: notes.length > 0 ? notes : ['All calculations completed successfully']
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error calculating CSP metrics:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
