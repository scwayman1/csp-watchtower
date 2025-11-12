import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { position } = await req.json();
    console.log('Analyzing premium for position:', position);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Calculate Return on Capital
    const cashSecured = position.strikePrice * 100 * position.contracts;
    const returnOnCapital = (position.premiumPerContract / position.strikePrice) * 100;
    const annualizedROC = (returnOnCapital / position.daysToExp) * 365;

    // Build comprehensive context for AI
    const context = `
Analyze this cash-secured put position and provide educational insights:

POSITION DETAILS:
- Symbol: ${position.symbol} (${position.underlyingName})
- Strike Price: $${position.strikePrice}
- Current Price: $${position.underlyingPrice}
- Premium per Contract: $${position.premiumPerContract}
- Number of Contracts: ${position.contracts}
- Days to Expiration: ${position.daysToExp}
- Expiration Date: ${position.expiration}

CALCULATED METRICS:
- Cash Secured: $${cashSecured.toFixed(2)}
- Total Premium: $${position.totalPremium.toFixed(2)}
- Return on Capital: ${returnOnCapital.toFixed(2)}%
- Annualized ROC: ${annualizedROC.toFixed(2)}%
- Distance to Strike: ${position.pctAboveStrike.toFixed(2)}% above
- Current Option Value: $${position.contractValue.toFixed(2)}
- Unrealized P/L: $${position.unrealizedPnL.toFixed(2)}
- Assignment Probability: ${position.probAssignment.toFixed(1)}%
- Risk Status: ${position.statusBand}
${position.dayChangePct !== undefined ? `- Daily Change: ${position.dayChangePct.toFixed(2)}%` : ''}

Please provide:
1. **Premium Quality Rating**: Rate this premium as "Excellent", "Good", "Fair", or "Poor" based on the Return on Capital
2. **Risk-Adjusted Analysis**: Evaluate if the premium adequately compensates for the assignment risk
3. **Educational Explanation**: Explain the key factors affecting this premium:
   - Time decay (theta) impact with ${position.daysToExp} days remaining
   - Implied volatility considerations
   - Moneyness effect (${position.pctAboveStrike.toFixed(1)}% above strike)
   - Risk/reward balance
4. **Alternative Suggestions**: Suggest 2-3 alternative strikes or expirations that might offer better value
   - Consider strikes further OTM for more safety
   - Consider different expirations for better time decay efficiency
5. **Action Recommendation**: Should the trader hold, roll, or close this position? Why?

Keep the response conversational and educational, helping the trader understand the "why" behind options pricing.`;

    console.log('Sending request to Lovable AI...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are an experienced options trading educator who explains complex concepts in simple, practical terms. Focus on Return on Capital, risk management, and helping traders understand the economics of their positions. Be specific with numbers and actionable with recommendations.'
          },
          {
            role: 'user',
            content: context
          }
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }), 
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits depleted. Please add credits to your workspace.' }), 
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const analysis = data.choices[0].message.content;

    console.log('AI analysis completed successfully');

    // Determine quality rating from the analysis
    let qualityRating: 'excellent' | 'good' | 'fair' | 'poor' = 'fair';
    const analysisLower = analysis.toLowerCase();
    if (analysisLower.includes('excellent')) qualityRating = 'excellent';
    else if (analysisLower.includes('good')) qualityRating = 'good';
    else if (analysisLower.includes('poor')) qualityRating = 'poor';

    return new Response(
      JSON.stringify({
        analysis,
        metrics: {
          cashSecured,
          returnOnCapital,
          annualizedROC,
          qualityRating,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in analyze-premium function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
