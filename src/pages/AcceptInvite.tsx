import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [message, setMessage] = useState("");

  useEffect(() => {
    acceptInvite();
  }, [token]);

  const acceptInvite = async () => {
    if (!token) {
      setStatus("error");
      setMessage("Invalid invite link");
      setLoading(false);
      return;
    }

    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // Redirect to auth with return URL
        const returnUrl = `/accept-invite/${token}`;
        navigate(`/auth?returnUrl=${encodeURIComponent(returnUrl)}`);
        return;
      }

      // Find the share by token using secure function
      const { data, error: fetchError } = await supabase
        .rpc("get_share_by_invite_token", { token_input: token });

      if (fetchError) throw fetchError;

      const share = data && data.length > 0 ? data[0] : null;

      if (!share) {
        setStatus("error");
        setMessage("Invite link not found or has expired");
        setLoading(false);
        return;
      }

      // Check if already accepted
      if (share.accepted_at) {
        setStatus("success");
        setMessage("You already have access to this dashboard");
        setLoading(false);
        return;
      }

      // Check if user email matches the invited email
      if (user.email !== share.shared_with_email) {
        setStatus("error");
        setMessage(`This invite is for ${share.shared_with_email}. Please sign in with that email.`);
        setLoading(false);
        return;
      }

      // Update share with user_id and accepted_at
      const { error: updateError } = await supabase
        .from("position_shares")
        .update({
          shared_with_user_id: user.id,
          accepted_at: new Date().toISOString(),
        })
        .eq("id", share.id);

      if (updateError) throw updateError;

      setStatus("success");
      setMessage("Successfully accepted invite! You now have access to the shared dashboard.");
      setLoading(false);

      toast({
        title: "Invite accepted!",
        description: "You can now view the shared dashboard.",
      });

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        navigate("/");
      }, 2000);

    } catch (error: any) {
      console.error("Error accepting invite:", error);
      setStatus("error");
      setMessage(error.message || "Failed to accept invite");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Dashboard Invite</CardTitle>
          <CardDescription>
            You've been invited to view a shared dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && status === "processing" && (
            <div className="flex flex-col items-center gap-2 py-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Processing invite...</p>
            </div>
          )}

          {!loading && status === "success" && (
            <div className="flex flex-col items-center gap-2 py-4">
              <CheckCircle className="h-8 w-8 text-success" />
              <p className="text-sm text-center">{message}</p>
              <Button onClick={() => navigate("/")} className="mt-4">
                Go to Dashboard
              </Button>
            </div>
          )}

          {!loading && status === "error" && (
            <div className="flex flex-col items-center gap-2 py-4">
              <XCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-center text-destructive">{message}</p>
              <Button onClick={() => navigate("/auth")} variant="outline" className="mt-4">
                Go to Login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
