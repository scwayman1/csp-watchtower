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
  clientId: string;
  clientName: string;
  clientEmail: string;
  advisorName?: string;
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

    const { clientId, clientName, clientEmail, advisorName, appUrl }: InviteRequest = await req.json();

    console.log(`Sending invitation to ${clientEmail} for client ${clientName}, appUrl: ${appUrl}`);

    // Fetch the invite token from the client record
    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .select("invite_token")
      .eq("id", clientId)
      .single();

    if (clientError || !clientData) {
      console.error("Error fetching client:", clientError);
      return new Response(
        JSON.stringify({ error: "Client not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const inviteToken = clientData.invite_token;
    const baseUrl = appUrl || "http://localhost:5173";
    const inviteUrl = `${baseUrl}/accept-client-invite/${inviteToken}`;

    const emailResponse = await resend.sendEmail({
      from: "The Wheel Terminal <onboarding@resend.dev>",
      to: [clientEmail],
      subject: `${advisorName || "Your Advisor"} has invited you to The Wheel Terminal`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px;">The Wheel Terminal</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Your Portfolio Command Center</p>
            </div>
            
            <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
              <h2 style="color: #1f2937; margin-top: 0;">Hello ${clientName},</h2>
              
              <p style="color: #4b5563; font-size: 16px;">
                ${advisorName || "Your advisor"} has invited you to join The Wheel Terminal, a professional options trading platform designed to help you track and manage your cash-secured put strategy.
              </p>
              
              <div style="background: #f9fafb; border-left: 4px solid #667eea; padding: 16px; margin: 24px 0;">
                <p style="margin: 0; color: #374151; font-weight: 500;">
                  Click the button below to accept your invitation and set up your account:
                </p>
              </div>
              
              <div style="text-align: center; margin: 32px 0;">
                <a href="${inviteUrl}" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 16px;">
                  Accept Invitation
                </a>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
                Or copy and paste this link into your browser:
              </p>
              <p style="color: #667eea; font-size: 14px; word-break: break-all;">
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

    console.log("Invitation email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, data: emailResponse }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error sending invitation email:", error);
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
