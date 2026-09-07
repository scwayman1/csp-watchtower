import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { getClientIp, normalizeEmail, sha256Hex } from "../_shared/access-control.ts";

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

    // Rate limit by client IP and SHA-256 token hash before any privileged work.
    const tokenHash = await sha256Hex(token);
    const ip = getClientIp(req);
    const { data: rateCheck, error: rateError } = await supabase.rpc(
      "check_invite_rate_limit",
      { p_ip_address: ip, p_token_hash: tokenHash }
    );
    if (!rateError && rateCheck && rateCheck.allowed === false) {
      return new Response(
        JSON.stringify({ error: rateCheck.reason ?? "Too many attempts. Please try again later." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify the invite exists and matches the provided id + token.
    const { data: invite, error: inviteError } = await supabase
      .from("advisor_invites")
      .select("*")
      .eq("id", inviteId)
      .eq("invite_token", token)
      .single();

    if (inviteError || !invite) {
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

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Invitation has expired" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Use the authoritative auth user email — never trust a client-supplied email.
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    const userEmail = userData?.user?.email;
    if (userError || !userEmail) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (normalizeEmail(userEmail) !== normalizeEmail(invite.email)) {
      return new Response(
        JSON.stringify({ error: "Invitation email does not match this account" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Atomically assign the advisor role and mark the invite accepted via RPC.
    const { error: rpcError } = await supabase.rpc("complete_advisor_signup", {
      p_invite_id: inviteId,
      p_token: token,
      p_user_id: userId,
      p_user_email: userEmail,
    });

    if (rpcError) {
      console.error("complete_advisor_signup RPC failed:", rpcError);
      return new Response(
        JSON.stringify({ error: rpcError.message }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    console.error("Error completing advisor signup:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
