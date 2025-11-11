import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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

interface InviteEmailRequest {
  inviterEmail: string;
  recipientEmail: string;
  appUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { inviterEmail, recipientEmail, appUrl }: InviteEmailRequest = await req.json();

    console.log("Sending invitation email to:", recipientEmail, "from:", inviterEmail);

    const emailResponse = await resend.sendEmail({
      from: "CSP Tracker <onboarding@resend.dev>",
      to: [recipientEmail],
      subject: `${inviterEmail} invited you to view their portfolio`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">You've been invited!</h1>
          <p style="color: #666; font-size: 16px; line-height: 1.5;">
            <strong>${inviterEmail}</strong> has invited you to view their Cash-Secured Put portfolio dashboard.
          </p>
          <p style="color: #666; font-size: 16px; line-height: 1.5;">
            You'll be able to see their:
          </p>
          <ul style="color: #666; font-size: 16px; line-height: 1.8;">
            <li>Active positions and metrics</li>
            <li>Assigned shares and covered calls</li>
            <li>Real-time performance data</li>
            <li>Historical trends and analytics</li>
          </ul>
          <div style="margin: 30px 0;">
            <a href="${appUrl}/auth" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              View Dashboard
            </a>
          </div>
          <p style="color: #999; font-size: 14px; margin-top: 30px;">
            Note: You'll need to create an account or sign in with this email address (${recipientEmail}) to access the shared dashboard.
          </p>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-invite-email function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: error.response?.body || error.toString()
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
