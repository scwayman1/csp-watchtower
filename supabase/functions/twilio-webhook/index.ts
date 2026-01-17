import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyTwilioWebhook } from "../_shared/verify-webhook.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-twilio-signature',
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify Twilio signature to ensure request is authentic
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    if (!twilioAuthToken) {
      console.error('TWILIO_AUTH_TOKEN not configured');
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'text/xml' } }
      );
    }

    const twilioSignature = req.headers.get('X-Twilio-Signature');
    const webhookUrl = Deno.env.get('TWILIO_WEBHOOK_URL') ||
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/twilio-webhook`;

    // Read raw body for signature verification
    const rawBody = await req.text();

    const verification = await verifyTwilioWebhook(
      rawBody,
      twilioSignature,
      twilioAuthToken,
      webhookUrl
    );

    if (!verification.ok) {
      console.error('Twilio signature verification failed:', verification.reason);
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'text/xml' } }
      );
    }

    // Parse form data from verified raw body
    const formData = new URLSearchParams(rawBody);
    const from = formData.get('From') as string;
    const body = formData.get('Body') as string;
    const messageSid = formData.get('MessageSid') as string;

    console.log(`Received inbound SMS from: ${from}, MessageSid: ${messageSid}`);

    if (!from || !body) {
      console.error("Missing required fields: From or Body");
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/xml' } }
      );
    }

    // Normalize phone number (remove +1 prefix for comparison)
    const normalizedPhone = from.replace(/^\+1/, '').replace(/\D/g, '');
    const phoneVariants = [
      from,
      `+1${normalizedPhone}`,
      normalizedPhone,
      normalizedPhone.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3'),
      normalizedPhone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3'),
    ];

    console.log(`Looking up client with phone variants: ${phoneVariants.join(', ')}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find client by phone number
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, user_id, advisor_id, name')
      .or(phoneVariants.map(p => `phone_number.eq.${p}`).join(','))
      .single();

    if (clientError || !client) {
      console.error("Client not found for phone:", from, clientError);
      // Return empty TwiML response (don't error out)
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/xml' } }
      );
    }

    console.log(`Found client: ${client.name} (${client.id})`);

    // Find existing thread between advisor and client
    let { data: thread, error: threadError } = await supabase
      .from('threads')
      .select('id')
      .eq('advisor_id', client.advisor_id)
      .eq('client_id', client.id)
      .single();

    // Create thread if it doesn't exist
    if (threadError || !thread) {
      console.log("Creating new thread for client");
      const { data: newThread, error: createError } = await supabase
        .from('threads')
        .insert({
          advisor_id: client.advisor_id,
          client_id: client.id,
          primary_client_id: client.id,
          subject: `Conversation with ${client.name}`,
        })
        .select('id')
        .single();

      if (createError || !newThread) {
        console.error("Failed to create thread:", createError);
        return new Response(
          '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/xml' } }
        );
      }
      thread = newThread;
    }

    console.log(`Using thread: ${thread.id}`);

    // Determine sender_id and recipient_id
    // For inbound SMS, sender is the client, recipient is the advisor
    const senderId = client.user_id || client.id; // Use user_id if linked, otherwise client.id
    const recipientId = client.advisor_id;

    // Insert the message
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        thread_id: thread.id,
        sender_id: senderId,
        recipient_id: recipientId,
        content: body,
        channel: 'sms',
        direction: 'inbound',
        provider_message_id: messageSid,
        meta: {
          from_phone: from,
          raw_form_data: Object.fromEntries(formData.entries()),
        },
      })
      .select()
      .single();

    if (messageError) {
      console.error("Failed to insert message:", messageError);
    } else {
      console.log(`Message inserted: ${message.id}`);
    }

    // Update thread's last_message_at
    await supabase
      .from('threads')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', thread.id);

    // Return empty TwiML response (acknowledgment)
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/xml' } }
    );

  } catch (error) {
    console.error("Error in twilio-webhook function:", error);
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/xml' } }
    );
  }
});
