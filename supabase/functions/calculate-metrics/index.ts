import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Black-Scholes approximation for put option pricing
function blackScholesPut(S: number, K: number, T: number, r: number, sigma: number): number {
  if (T <= 0) return Math.max(K - S, 0);
  
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  
  const normCDF = (x: number) => {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - prob : prob;
  };
  
  return K * Math.exp(-r * T) * normCDF(-d2) - S * normCDF(-d1);
}

// Heuristic assignment probability using sigmoid
function heuristicProbability(underlyingPrice: number, strikePrice: number, daysToExp: number): number {
  const volSensitivity = 0.15;
  const pctDiff = (underlyingPrice - strikePrice) / strikePrice;
  const timeDecay = Math.max(0.1, daysToExp / 365);
  
  // Sigmoid function: higher probability when underlying is close to or below strike
  const z = -(pctDiff / (volSensitivity * Math.sqrt(timeDecay)));
  const prob = 1 / (1 + Math.exp(-z * 5)); // Scale factor 5 for steeper curve
  
  return Math.max(0, Math.min(100, prob * 100));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { position, underlyingPrice, markPrice } = await req.json();

    if (!position || !underlyingPrice) {
      return new Response(
        JSON.stringify({ error: 'Missing required data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const today = new Date();
    const expiration = new Date(position.expiration);
    const daysToExp = Math.max(0, Math.ceil((expiration.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    
    const pctAboveStrike = ((underlyingPrice - position.strike_price) / position.strike_price) * 100;
    
    // Determine status band
    let statusBand: string;
    if (pctAboveStrike >= 10) {
      statusBand = 'success';
    } else if (pctAboveStrike >= 5) {
      statusBand = 'warning';
    } else {
      statusBand = 'destructive';
    }

    // Calculate contract value
    let contractValue: number;
    if (markPrice && markPrice > 0) {
      contractValue = markPrice * 100 * position.contracts;
    } else {
      // Fallback to Black-Scholes
      const T = daysToExp / 365;
      const r = 0.05; // Risk-free rate assumption
      const sigma = 0.30; // Volatility assumption
      const bsPrice = blackScholesPut(underlyingPrice, position.strike_price, T, r, sigma);
      contractValue = bsPrice * 100 * position.contracts;
    }

    const totalPremium = position.premium_per_contract * 100 * position.contracts;
    const unrealizedPnL = totalPremium - contractValue - (position.open_fees || 0);

    // Calculate probability of assignment
    const probAssignment = heuristicProbability(underlyingPrice, position.strike_price, daysToExp);

    const metrics = {
      daysToExp,
      pctAboveStrike: parseFloat(pctAboveStrike.toFixed(2)),
      statusBand,
      contractValue: parseFloat(contractValue.toFixed(2)),
      totalPremium: parseFloat(totalPremium.toFixed(2)),
      unrealizedPnL: parseFloat(unrealizedPnL.toFixed(2)),
      probAssignment: parseFloat(probAssignment.toFixed(1)),
    };

    return new Response(
      JSON.stringify(metrics),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error calculating metrics:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to calculate metrics';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});