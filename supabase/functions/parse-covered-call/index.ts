import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderText, assignedPositionId } = await req.json();
    
    if (!orderText || !assignedPositionId) {
      return new Response(
        JSON.stringify({ error: 'Missing orderText or assignedPositionId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Parsing covered call order:", orderText);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a covered call order parser. Extract the following information from broker order text:
- strike_price: The strike price of the call option
- expiration: The expiration date (convert to YYYY-MM-DD format)
- premium_per_contract: The premium received per contract
- contracts: The number of contracts sold

Return ONLY a JSON object with these exact fields. Example:
{"strike_price": 150.00, "expiration": "2024-12-20", "premium_per_contract": 2.50, "contracts": 1}`
          },
          {
            role: "user",
            content: orderText
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "parse_covered_call",
              description: "Parse covered call order details",
              parameters: {
                type: "object",
                properties: {
                  strike_price: { type: "number", description: "Strike price of the call" },
                  expiration: { type: "string", description: "Expiration date in YYYY-MM-DD format" },
                  premium_per_contract: { type: "number", description: "Premium per contract" },
                  contracts: { type: "integer", description: "Number of contracts" }
                },
                required: ["strike_price", "expiration", "premium_per_contract", "contracts"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "parse_covered_call" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const aiResponse = await response.json();
    console.log("AI Response:", JSON.stringify(aiResponse));

    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No tool call in AI response");
    }

    const parsedData = JSON.parse(toolCall.function.arguments);
    console.log("Parsed covered call:", parsedData);

    // Insert into database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: insertedCall, error: insertError } = await supabase
      .from('covered_calls')
      .insert({
        assigned_position_id: assignedPositionId,
        strike_price: parsedData.strike_price,
        expiration: parsedData.expiration,
        premium_per_contract: parsedData.premium_per_contract,
        contracts: parsedData.contracts,
        is_active: true
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw insertError;
    }

    console.log("Covered call inserted:", insertedCall);

    return new Response(
      JSON.stringify({ success: true, coveredCall: insertedCall }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
