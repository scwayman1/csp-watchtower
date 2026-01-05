import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LearningPosition {
  symbol: string;
  strike_price: number;
  expiration: string;
  contracts: number;
  premium_per_contract: number;
  is_active: boolean;
  opened_at: string;
}

interface LearningAssigned {
  symbol: string;
  shares: number;
  cost_basis: number;
  assignment_price: number;
  is_active: boolean;
  assignment_date: string;
  original_put_premium: number;
}

interface AnalysisRequest {
  clientName: string;
  positions: LearningPosition[];
  assignedPositions: LearningAssigned[];
  startingCapital: number;
  daysActive: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientName, positions, assignedPositions, startingCapital, daysActive }: AnalysisRequest = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Calculate derived metrics for context
    const totalPremium = positions.reduce((sum, p) => sum + (p.premium_per_contract * p.contracts * 100), 0);
    const activeTrades = positions.filter(p => p.is_active).length;
    const closedTrades = positions.filter(p => !p.is_active).length;
    const assignmentRate = positions.length > 0 ? (assignedPositions.length / positions.length * 100) : 0;
    
    // Analyze position characteristics
    const positionDetails = positions.map(p => {
      const daysToExpiration = Math.ceil((new Date(p.expiration).getTime() - new Date(p.opened_at).getTime()) / (1000 * 60 * 60 * 24));
      const notionalRisk = p.strike_price * p.contracts * 100;
      return {
        symbol: p.symbol,
        strike: p.strike_price,
        dte: daysToExpiration,
        contracts: p.contracts,
        premium: p.premium_per_contract * p.contracts * 100,
        notionalRisk,
        isActive: p.is_active,
      };
    });

    const assignmentDetails = assignedPositions.map(a => ({
      symbol: a.symbol,
      shares: a.shares,
      costBasis: a.cost_basis,
      putPremiumReceived: a.original_put_premium,
      isActive: a.is_active,
    }));

    // Find patterns
    const symbols = [...new Set(positions.map(p => p.symbol))];
    const avgDte = positionDetails.length > 0 
      ? positionDetails.reduce((sum, p) => sum + p.dte, 0) / positionDetails.length 
      : 0;
    const weeklyCount = positionDetails.filter(p => p.dte <= 7).length;
    const monthlyCount = positionDetails.filter(p => p.dte >= 25 && p.dte <= 35).length;

    const systemPrompt = `You are an experienced options trading coach reviewing a client's paper trading activity in a Learning Center simulator. Your role is to provide thoughtful, constructive feedback that helps the client improve their options trading skills.

Be specific about what patterns you observe. Be encouraging but honest. Identify both strengths and areas for improvement. Suggest concrete next steps. 

Important context:
- This is simulated/paper trading for learning purposes
- The goal is to prepare clients for real cash-secured put and covered call strategies (The Wheel)
- Conservative, income-focused strategies are generally preferred
- Shorter DTEs are riskier but can be appropriate in certain market conditions
- High-volatility stocks offer more premium but higher assignment risk
- Diversification across sectors and expirations is important

Write in a conversational, coaching tone. Use markdown formatting with headers and bullet points for readability.`;

    const userPrompt = `Please analyze ${clientName}'s learning center activity and provide coaching insights.

## Trading Summary
- Days Active: ${daysActive}
- Starting Capital: $${startingCapital.toLocaleString()}
- Total Trades: ${positions.length}
- Active Positions: ${activeTrades}
- Closed Positions: ${closedTrades}
- Total Premium Collected: $${totalPremium.toFixed(2)}
- Assignment Rate: ${assignmentRate.toFixed(1)}%
- Unique Symbols Traded: ${symbols.length} (${symbols.slice(0, 10).join(', ')}${symbols.length > 10 ? '...' : ''})

## Position Characteristics
- Average DTE at Entry: ${avgDte.toFixed(1)} days
- Weekly Trades (≤7 DTE): ${weeklyCount} (${positions.length > 0 ? ((weeklyCount/positions.length)*100).toFixed(1) : 0}%)
- Monthly Trades (25-35 DTE): ${monthlyCount} (${positions.length > 0 ? ((monthlyCount/positions.length)*100).toFixed(1) : 0}%)

## Recent Positions
${positionDetails.slice(0, 15).map(p => 
  `- ${p.symbol}: $${p.strike} strike, ${p.dte} DTE, ${p.contracts} contracts, $${p.premium.toFixed(2)} premium, notional: $${p.notionalRisk.toLocaleString()}`
).join('\n')}

## Assignments Experienced
${assignmentDetails.length > 0 ? assignmentDetails.map(a => 
  `- ${a.symbol}: ${a.shares} shares @ $${(a.costBasis/a.shares).toFixed(2)}/share, original premium: $${a.putPremiumReceived.toFixed(2)}, ${a.isActive ? 'still holding' : 'sold'}`
).join('\n') : 'No assignments yet'}

Please provide:
1. **Overall Assessment**: A 2-3 sentence summary of their trading approach
2. **Strengths Observed**: What are they doing well?
3. **Areas for Improvement**: What patterns concern you or could be optimized?
4. **Risk Management Observations**: Comments on position sizing, diversification, and capital allocation
5. **Specific Recommendations**: 2-3 concrete action items for improvement
6. **Coaching Questions**: 1-2 questions to ask in your next coaching session`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content;

    if (!analysis) {
      throw new Error("No analysis generated");
    }

    return new Response(JSON.stringify({ 
      analysis,
      metrics: {
        totalPremium,
        assignmentRate,
        avgDte,
        weeklyPercentage: positions.length > 0 ? (weeklyCount/positions.length)*100 : 0,
        symbolCount: symbols.length,
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in analyze-learning-activity:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
