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

    // This function intentionally remains pre-auth: Supabase may require email
    // confirmation and return no session immediately after sign-up. The
    // service-role lookup supplies the authoritative email for the new user;
    // the RPC then compares it to the invite inside the same transaction.
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !user || !user.email) {
      return new Response(JSON.stringify({ error: "Signup account not found" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const tokenHash = await sha256Hex(token);
    const { data: limit, error: limitError } = await supabase.rpc("check_invite_rate_limit", {
      p_ip_address: getClientIp(req),
      p_token_hash: tokenHash,
    });
    if (limitError || !limit?.allowed) {
      return new Response(JSON.stringify({ error: "Too many invitation attempts. Please try again later." }), {
        status: 429, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: result, error: completionError } = await supabase.rpc("complete_advisor_signup", {
      p_invite_id: inviteId,
      p_token: token,
      p_user_id: userId,
      p_user_email: normalizeEmail(user.email),
    });
    if (completionError) throw completionError;
    if (!result?.success) {
      return new Response(JSON.stringify({ error: result?.error || "Unable to accept invitation" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

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
