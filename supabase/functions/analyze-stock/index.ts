import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol, position } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const prompt = `You are a financial analyst AI. Analyze this cash-secured put position and provide a brief analysis.

Position Details:
- Symbol: ${symbol}
- Strike Price: $${position.strikePrice}
- Days to Expiration: ${position.daysToExp}
- Premium Collected: $${position.totalPremium}
- Current Price Above Strike: ${position.pctAboveStrike?.toFixed(2) || 'N/A'}%
- Unrealized P/L: $${position.unrealizedPnL?.toFixed(2) || 'N/A'}
- Status Band: ${position.statusBand || 'N/A'}

Provide a JSON response with:
1. "summary": A 1-2 sentence analysis of this position
2. "suggestion": A specific actionable suggestion (hold, roll, close early, etc.)
3. "risk_level": "low", "medium", or "high"
4. "news_keywords": 3 keywords for searching recent news about this stock`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a helpful financial analyst AI. Always respond with valid JSON only, no markdown or extra text." },
          { role: "user", content: prompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_position",
              description: "Analyze a stock position and provide insights",
              parameters: {
                type: "object",
                properties: {
                  summary: { 
                    type: "string", 
                    description: "1-2 sentence analysis of the position" 
                  },
                  suggestion: { 
                    type: "string", 
                    description: "Specific actionable suggestion" 
                  },
                  risk_level: { 
                    type: "string", 
                    enum: ["low", "medium", "high"],
                    description: "Risk level assessment" 
                  },
                  news_keywords: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "3 keywords for news search" 
                  }
                },
                required: ["summary", "suggestion", "risk_level", "news_keywords"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "analyze_position" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract the tool call response
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const analysis = JSON.parse(toolCall.function.arguments);
      
      // Generate news links based on keywords
      const newsLinks = analysis.news_keywords.map((keyword: string) => ({
        title: `${symbol} ${keyword} news`,
        url: `https://www.google.com/search?q=${encodeURIComponent(`${symbol} stock ${keyword} news`)}&tbm=nws`
      }));

      return new Response(JSON.stringify({
        ...analysis,
        newsLinks,
        symbol
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("No analysis generated");
  } catch (error) {
    console.error("Error analyzing stock:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
