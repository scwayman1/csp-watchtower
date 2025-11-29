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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Decode the JWT directly to get the user id. The platform
    // already verified this token because verify_jwt = true.
    const token = authHeader.replace('Bearer ', '').trim();
    let userId: string | null = null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1] || ''));
      userId = payload.sub || payload.user_id || null;
    } catch (e) {
      console.error('Failed to parse JWT payload', e);
    }

    if (!userId) throw new Error('Not authenticated');

    console.log('Cleaning up expired positions for user:', userId);

    // Delete all existing expired positions for this user
    const { error: deleteError } = await supabase
      .from('positions')
      .delete()
      .eq('user_id', userId)
      .eq('is_active', false);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      throw deleteError;
    }

    // Insert the 13 correct positions from Nov 6, 2025 PDF
    const correctPositions = [
      { symbol: 'QQQ', strike_price: 605, expiration: '2025-11-28', contracts: 1, premium_per_contract: 6.42 },
      { symbol: 'AMZN', strike_price: 240, expiration: '2025-11-28', contracts: 2, premium_per_contract: 3.25 },
      { symbol: 'CRM', strike_price: 235, expiration: '2025-11-28', contracts: 2, premium_per_contract: 3.47 },
      { symbol: 'CRWD', strike_price: 485, expiration: '2025-11-28', contracts: 2, premium_per_contract: 6.66 },
      { symbol: 'DDOG', strike_price: 170, expiration: '2025-11-28', contracts: 2, premium_per_contract: 2.30 },
      { symbol: 'DIA', strike_price: 469, expiration: '2025-11-28', contracts: 1, premium_per_contract: 4.96 },
      { symbol: 'GOOG', strike_price: 270, expiration: '2025-11-28', contracts: 2, premium_per_contract: 2.71 },
      { symbol: 'INTU', strike_price: 590, expiration: '2025-11-28', contracts: 1, premium_per_contract: 7.20 },
      { symbol: 'MSFT', strike_price: 490, expiration: '2025-11-28', contracts: 1, premium_per_contract: 5.89 },
      { symbol: 'NVDA', strike_price: 175, expiration: '2025-11-28', contracts: 2, premium_per_contract: 2.51 },
      { symbol: 'UBER', strike_price: 87, expiration: '2025-11-28', contracts: 1, premium_per_contract: 1.28 },
      { symbol: 'WMT', strike_price: 96, expiration: '2025-11-28', contracts: 1, premium_per_contract: 1.32 },
      { symbol: 'META', strike_price: 590, expiration: '2025-11-28', contracts: 2, premium_per_contract: 6.90 },
    ];

    const positionsToInsert = correctPositions.map(pos => ({
      user_id: userId,
      symbol: pos.symbol,
      strike_price: pos.strike_price,
      expiration: pos.expiration,
      contracts: pos.contracts,
      premium_per_contract: pos.premium_per_contract,
      opened_at: '2025-11-06',
      is_active: false,
      broker: 'Thrivent',
    }));

    const { data: insertedData, error: insertError } = await supabase
      .from('positions')
      .insert(positionsToInsert)
      .select();

    if (insertError) {
      console.error('Insert error:', insertError);
      throw insertError;
    }

    console.log(`Successfully inserted ${insertedData.length} positions`);

    // Calculate total premium
    const totalPremium = correctPositions.reduce((sum, pos) => 
      sum + (pos.premium_per_contract * pos.contracts * 100), 0
    );

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Cleaned up and inserted ${insertedData.length} expired positions`,
        totalPremium: totalPremium.toFixed(2),
        positions: insertedData.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Cleanup error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Cleanup failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
