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
    const { statementText } = await req.json();
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get existing positions from database
    const { data: dbPositions, error: dbError } = await supabase
      .from('positions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', false)
      .order('opened_at', { ascending: false });

    if (dbError) throw dbError;

    // Use Lovable AI to reconcile statement with database
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const aiPrompt = `You are a financial data reconciliation expert. Analyze this broker statement and compare it with the database records.

BROKER STATEMENT:
${statementText}

DATABASE RECORDS (${dbPositions?.length || 0} expired positions):
${JSON.stringify(dbPositions, null, 2)}

Your task:
1. Extract the TOTAL ACCOUNT VALUE from the broker statement (look for labels like "Total Account Value", "Net Worth", "Total Assets", "Account Balance", etc.)
2. Extract ALL cash-secured put positions from the broker statement
3. For each position, extract: symbol, contracts, premium per contract, total premium collected, date opened
4. Compare extracted positions with database records
5. Identify discrepancies: missing positions, incorrect premiums, wrong dates
6. Calculate the correct total premium that should be in the database
7. Provide a reconciliation report with specific action items

Return a JSON object with this structure:
{
  "totalAccountValue": 838014.43,
  "extractedPositions": [
    {
      "symbol": "AAPL",
      "contracts": 1,
      "premiumPerContract": 2.50,
      "totalPremium": 250.00,
      "dateOpened": "2025-11-06",
      "expiration": "2025-12-20"
    }
  ],
  "databaseTotal": 1469.00,
  "statementTotal": 8266.60,
  "discrepancy": 6797.60,
  "missingPositions": [...],
  "incorrectPositions": [...],
  "actionItems": [
    "Delete 4 incorrect positions from Nov 11",
    "Import 13 positions from Nov 6 batch"
  ],
  "summary": "Database is missing the entire November 6, 2025 batch..."
}`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            content: 'You are a precise financial reconciliation assistant. Always return valid JSON and exact numbers from broker statements.'
          },
          { role: 'user', content: aiPrompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI request failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const reconciliationReport = JSON.parse(aiData.choices[0].message.content);

    console.log('Reconciliation Report:', reconciliationReport);

    return new Response(
      JSON.stringify({ 
        reconciliation: reconciliationReport,
        databasePositions: dbPositions 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Reconciliation error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Reconciliation failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});