import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId, inviteId, token } = await req.json();

    if (!userId || !inviteId || !token) {
      return new Response(
        JSON.stringify({ error: "userId, inviteId, and token are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Completing advisor signup for user ${userId}, invite ${inviteId}`);

    // Verify the invite token matches
    const { data: invite, error: inviteError } = await supabase
      .from("advisor_invites")
      .select("*")
      .eq("id", inviteId)
      .eq("invite_token", token)
      .single();

    if (inviteError || !invite) {
      console.error("Invite verification failed:", inviteError);
      return new Response(
        JSON.stringify({ error: "Invalid invitation" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (invite.status === "ACCEPTED") {
      return new Response(
        JSON.stringify({ error: "Invitation already accepted" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Assign advisor role to the user
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({
        user_id: userId,
        role: "advisor",
      });

    if (roleError) {
      // Might already have the role if trigger assigned it
      console.log("Role assignment result:", roleError.message);
      
      // Try upsert approach
      const { error: upsertError } = await supabase
        .from("user_roles")
        .upsert({
          user_id: userId,
          role: "advisor",
        }, { onConflict: "user_id,role" });
      
      if (upsertError) {
        console.error("Role upsert failed:", upsertError);
      }
    }

    console.log(`Advisor role assigned to user ${userId}`);

    // Update the invite status
    const { error: updateError } = await supabase
      .from("advisor_invites")
      .update({
        status: "ACCEPTED",
        user_id: userId,
        accepted_at: new Date().toISOString(),
      })
      .eq("id", inviteId);

    if (updateError) {
      console.error("Error updating invite status:", updateError);
    }

    console.log(`Invite ${inviteId} marked as accepted`);

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error completing advisor signup:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
