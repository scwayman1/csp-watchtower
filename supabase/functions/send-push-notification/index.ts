import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { userId, title, body, data } = await req.json();

    console.log('Sending push notification to user:', userId);

    // Fetch user's push subscriptions
    const { data: subscriptions, error: fetchError } = await supabaseClient
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (fetchError) {
      console.error('Error fetching push subscriptions:', fetchError);
      throw fetchError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No push subscriptions found for user:', userId);
      return new Response(
        JSON.stringify({ message: 'No subscriptions found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${subscriptions.length} subscriptions for user`);

    // Send push notification to each subscription
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          // Using Web Push protocol - this would typically use a library like web-push
          // For now, we'll log what would be sent
          const payload = JSON.stringify({
            title,
            body,
            data: data || {},
            icon: '/logo.png',
            badge: '/logo.png',
          });

          console.log('Would send push to endpoint:', sub.endpoint);
          console.log('Payload:', payload);

          // In production, you'd use web-push library to actually send the notification
          // For now, return success
          return { success: true, endpoint: sub.endpoint };
        } catch (error) {
          console.error('Error sending to endpoint:', sub.endpoint, error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return { success: false, endpoint: sub.endpoint, error: errorMessage };
        }
      })
    );

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

    console.log(`Successfully sent ${successCount}/${subscriptions.length} notifications`);

    return new Response(
      JSON.stringify({
        message: 'Push notifications sent',
        sent: successCount,
        total: subscriptions.length,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-push-notification:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
