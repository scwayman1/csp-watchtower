import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { setVapidDetails, sendNotification } from 'https://esm.sh/web-push@3.6.7';

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

    console.log('Sending push notification to user:', userId, { title, body });

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
        JSON.stringify({ message: 'No subscriptions found', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${subscriptions.length} subscriptions for user`);

    // Configure VAPID details
    const vapidPrivateKey = Deno.env.get('WEB_PUSH_PRIVATE_KEY');
    const vapidContact = Deno.env.get('WEB_PUSH_CONTACT');
    
    if (!vapidPrivateKey || !vapidContact) {
      throw new Error('VAPID keys not configured');
    }

    setVapidDetails(
      vapidContact,
      'BL4Ce-e57TSFPVbrtHDO1gqEHsYHIczjGdomub11lb4eRY1bGJNK-vrvyjclx0MOfTpazOsM4sj7nnUkzhod88Q',
      vapidPrivateKey
    );

    // Send push notification to each subscription
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        const payload = JSON.stringify({
          title: title || 'New Message',
          body: body || 'You have received a new message',
          icon: '/logo.png',
          badge: '/logo.png',
          data: data || {},
        });

        try {
          await sendNotification(pushSubscription, payload);
          console.log(`✓ Sent notification to endpoint: ${sub.endpoint.substring(0, 50)}...`);
          return { success: true, endpoint: sub.endpoint };
        } catch (error: any) {
          console.error(`✗ Failed to send to endpoint ${sub.endpoint.substring(0, 50)}:`, error);
          
          // If subscription is invalid (410 Gone, 404 Not Found), remove it from database
          if (error.statusCode === 410 || error.statusCode === 404) {
            await supabaseClient
              .from('push_subscriptions')
              .delete()
              .eq('id', sub.id);
            console.log(`Removed invalid subscription: ${sub.id}`);
          }
          
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return { success: false, endpoint: sub.endpoint, error: errorMessage };
        }
      })
    );

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failedCount = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;

    console.log(`Summary: ${successCount} sent, ${failedCount} failed out of ${subscriptions.length} total`);

    return new Response(
      JSON.stringify({
        message: 'Push notifications processed',
        sent: successCount,
        failed: failedCount,
        total: subscriptions.length,
        results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: 'rejected' })
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
