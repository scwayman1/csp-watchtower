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

    const { userId, clientId, token, fullName } = await req.json();

    if (!userId || !clientId || !token) {
      return new Response(
        JSON.stringify({ error: "userId, clientId, and token are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Completing client signup for user ${userId}, client ${clientId}`);

    // Verify the invite token matches and fetch client data
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .eq("invite_token", token)
      .single();

    if (clientError || !client) {
      console.error("Client verification failed:", clientError);
      return new Response(
        JSON.stringify({ error: "Invalid invitation" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (client.invite_status === "ACCEPTED") {
      return new Response(
        JSON.stringify({ error: "Invitation already accepted" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if the user_id is already linked to another client
    if (client.user_id && client.user_id !== userId) {
      console.error(`Client ${clientId} already linked to user ${client.user_id}`);
      return new Response(
        JSON.stringify({ error: "This invitation is already linked to another account" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Ensure the user has the investor role
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({
        user_id: userId,
        role: "investor",
      });

    if (roleError) {
      // Might already have the role
      console.log("Role assignment result:", roleError.message);

      // Try upsert approach
      const { error: upsertError } = await supabase
        .from("user_roles")
        .upsert({
          user_id: userId,
          role: "investor",
        }, { onConflict: "user_id,role" });

      if (upsertError) {
        console.error("Role upsert failed:", upsertError);
      }
    }

    console.log(`Investor role ensured for user ${userId}`);

    // Create profile if it doesn't exist
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (!existingProfile) {
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          user_id: userId,
          full_name: fullName || client.name || ""
        });

      if (profileError) {
        console.error("Failed to create profile:", profileError);
      } else {
        console.log(`Profile created for user ${userId}`);
      }
    }

    // Create user_settings if missing
    const { data: existingSettings } = await supabase
      .from("user_settings")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (!existingSettings) {
      const { error: settingsError } = await supabase
        .from("user_settings")
        .insert({ user_id: userId });

      if (settingsError) {
        console.error("Failed to create user_settings:", settingsError);
      } else {
        console.log(`User settings created for user ${userId}`);
      }
    }

    // Create simulator_settings if missing
    const { data: existingSimSettings } = await supabase
      .from("simulator_settings")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (!existingSimSettings) {
      const { error: simError } = await supabase
        .from("simulator_settings")
        .insert({ user_id: userId });

      if (simError) {
        console.error("Failed to create simulator_settings:", simError);
      } else {
        console.log(`Simulator settings created for user ${userId}`);
      }
    }

    // Update the client record with user_id and invite status
    const { error: updateError } = await supabase
      .from("clients")
      .update({
        user_id: userId,
        invite_status: "ACCEPTED",
      })
      .eq("id", clientId);

    if (updateError) {
      console.error("Error updating client:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to link account to invitation" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Client ${clientId} linked to user ${userId} and marked as accepted`);

    // Return advisor info for the success message
    return new Response(
      JSON.stringify({
        success: true,
        advisorId: client.advisor_id
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error completing client signup:", error);
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
