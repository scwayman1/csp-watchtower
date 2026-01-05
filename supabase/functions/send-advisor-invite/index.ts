import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

// Resend API client
class ResendClient {
  private apiKey: string;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async sendEmail(options: {
    from: string;
    to: string[];
    subject: string;
    html: string;
  }) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Resend API error: ${response.status} ${error}`);
    }

    return response.json();
  }
}

const resend = new ResendClient(Deno.env.get("RESEND_API_KEY") || "");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  advisorEmail: string;
  advisorName: string;
  invitedByName?: string;
  appUrl?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the auth user from the request
    const authHeader = req.headers.get('Authorization');
    let invitedById: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      invitedById = user?.id || null;
    }

    const { advisorEmail, advisorName, invitedByName, appUrl }: InviteRequest = await req.json();

    console.log(`Creating advisor invitation for ${advisorEmail} (${advisorName})`);

    // Check if invite already exists
    const { data: existingInvite } = await supabase
      .from("advisor_invites")
      .select("*")
      .eq("email", advisorEmail)
      .single();

    let inviteToken: string;

    if (existingInvite) {
      if (existingInvite.status === "ACCEPTED") {
        return new Response(
          JSON.stringify({ error: "This advisor has already accepted an invitation" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      // Use existing token
      inviteToken = existingInvite.invite_token;
      console.log(`Using existing invite token for ${advisorEmail}`);
    } else {
      // Create new invite record
      const { data: newInvite, error: insertError } = await supabase
        .from("advisor_invites")
        .insert({
          email: advisorEmail,
          name: advisorName,
          invited_by: invitedById,
          status: "PENDING",
        })
        .select()
        .single();

      if (insertError || !newInvite) {
        console.error("Error creating invite:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to create invitation" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      inviteToken = newInvite.invite_token;
      console.log(`Created new invite for ${advisorEmail} with token ${inviteToken}`);
    }

    // Prefer an explicit appUrl from the caller; otherwise fall back to request headers.
    // This avoids sending links to an unpublished default domain.
    const safeOriginFromHeaders = (() => {
      const origin = req.headers.get("origin");
      if (origin) return origin;

      const referer = req.headers.get("referer");
      if (referer) {
        try {
          return new URL(referer).origin;
        } catch {
          // ignore
        }
      }

      return null;
    })();

    const baseUrl = (appUrl || safeOriginFromHeaders || "").trim();

    if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) {
      console.error("Missing/invalid baseUrl for advisor invite", { appUrl, origin: req.headers.get("origin"), referer: req.headers.get("referer") });
      return new Response(
        JSON.stringify({ error: "Missing app URL for invitation link" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const inviteUrl = `${baseUrl}/accept-advisor-invite/${inviteToken}`;

    const emailResponse = await resend.sendEmail({
      from: "The Wheel Terminal <onboarding@resend.dev>",
      to: [advisorEmail],
      subject: `You're Invited as an Advisor to The Wheel Terminal`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px;">The Wheel Terminal</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Advisor Platform</p>
            </div>
            
            <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
              <h2 style="color: #1f2937; margin-top: 0;">Hello ${advisorName},</h2>
              
              <p style="color: #4b5563; font-size: 16px;">
                ${invitedByName ? `${invitedByName} has` : "You've been"} invited you to join The Wheel Terminal as a <strong>Financial Advisor</strong>.
              </p>

              <p style="color: #4b5563; font-size: 16px;">
                As an advisor, you'll have access to:
              </p>
              
              <ul style="color: #4b5563; font-size: 15px; padding-left: 20px;">
                <li>Client portfolio management dashboard</li>
                <li>Cycle-based trade recommendations</li>
                <li>Model trade allocation tools</li>
                <li>Multi-channel client communication</li>
                <li>Real-time portfolio analytics</li>
              </ul>
              
              <div style="background: #f0fdf4; border-left: 4px solid #059669; padding: 16px; margin: 24px 0;">
                <p style="margin: 0; color: #374151; font-weight: 500;">
                  Click the button below to accept your invitation and set up your advisor account:
                </p>
              </div>
              
              <div style="text-align: center; margin: 32px 0;">
                <a href="${inviteUrl}" 
                   style="background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 16px;">
                  Accept Advisor Invitation
                </a>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
                Or copy and paste this link into your browser:
              </p>
              <p style="color: #059669; font-size: 14px; word-break: break-all;">
                ${inviteUrl}
              </p>
              
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
              
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                If you didn't expect this invitation, you can safely ignore this email.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
              <p>© ${new Date().getFullYear()} The Wheel Terminal. All rights reserved.</p>
            </div>
          </body>
        </html>
      `,
    });

    console.log("Advisor invitation email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, inviteToken, data: emailResponse }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error sending advisor invitation email:", error);
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
