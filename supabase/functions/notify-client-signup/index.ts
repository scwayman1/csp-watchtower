import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyInternalServiceToken } from "../_shared/verify-webhook.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyRequest {
  clientId: string;
  clientName: string;
  advisorId: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify this is an internal service call with service role key
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const verification = verifyInternalServiceToken(req, serviceRoleKey);
    if (!verification.ok) {
      console.error("Service token verification failed:", verification.reason);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceRoleKey
    );

    const { clientId, clientName, advisorId }: NotifyRequest = await req.json();

    console.log(`Notifying advisor ${advisorId} about new client signup: ${clientName}`);

    // Find or create a thread for this advisor-client pair
    let threadId: string;

    const { data: existingThread } = await supabase
      .from("threads")
      .select("id")
      .eq("advisor_id", advisorId)
      .eq("client_id", clientId)
      .single();

    if (existingThread) {
      threadId = existingThread.id;
      console.log(`Using existing thread: ${threadId}`);
    } else {
      // Create a new thread
      const { data: newThread, error: threadError } = await supabase
        .from("threads")
        .insert({
          advisor_id: advisorId,
          client_id: clientId,
          subject: `Welcome ${clientName}`,
        })
        .select("id")
        .single();

      if (threadError) {
        console.error("Error creating thread:", threadError);
        throw threadError;
      }

      threadId = newThread.id;
      console.log(`Created new thread: ${threadId}`);
    }

    // Create a system notification message
    const { data: message, error: messageError } = await supabase
      .from("messages")
      .insert({
        thread_id: threadId,
        sender_id: advisorId, // System message attributed to advisor
        recipient_id: advisorId,
        content: `🎉 ${clientName} has accepted your invitation and created their account! They now have access to their investor dashboard.`,
        channel: "system",
        direction: "system",
      })
      .select()
      .single();

    if (messageError) {
      console.error("Error creating message:", messageError);
      throw messageError;
    }

    console.log(`Created notification message: ${message.id}`);

    // Update thread's last_message_at
    await supabase
      .from("threads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", threadId);

    // Try to send push notification if advisor has subscriptions
    const { data: pushSubs } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", advisorId);

    if (pushSubs && pushSubs.length > 0) {
      console.log(`Found ${pushSubs.length} push subscriptions for advisor`);
      
      // Call the send-push-notification function
      try {
        const pushResponse = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push-notification`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              userId: advisorId,
              title: "New Client Signup! 🎉",
              body: `${clientName} has accepted your invitation and created their account.`,
              url: "/advisor/clients",
            }),
          }
        );
        
        if (pushResponse.ok) {
          console.log("Push notification sent successfully");
        } else {
          console.log("Push notification failed:", await pushResponse.text());
        }
      } catch (pushError) {
        console.error("Error sending push notification:", pushError);
        // Don't fail the whole request if push fails
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: message.id,
        threadId 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in notify-client-signup:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
