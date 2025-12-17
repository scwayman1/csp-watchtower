import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, TrendingUp, User, Mail, Lock, CheckCircle2, XCircle, ArrowRight } from "lucide-react";

export default function AcceptClientInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<any>(null);
  const [advisorName, setAdvisorName] = useState<string>("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [step, setStep] = useState<"loading" | "invalid" | "form" | "success">("loading");

  useEffect(() => {
    validateInvite();
  }, [token]);

  const validateInvite = async () => {
    try {
      // Fetch client and advisor info
      const { data, error } = await supabase
        .from("clients")
        .select(`
          *,
          profiles:advisor_id (
            full_name
          )
        `)
        .eq("invite_token", token)
        .single();

      if (error || !data) {
        setStep("invalid");
        return;
      }

      if (data.invite_status === "ACCEPTED") {
        toast.error("This invitation has already been accepted");
        setStep("invalid");
        return;
      }

      setClient(data);
      setEmail(data.email || "");
      setFullName(data.name || "");
      
      // Try to get advisor name from profiles table
      if (data.advisor_id) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", data.advisor_id)
          .single();
        
        if (profileData?.full_name) {
          setAdvisorName(profileData.full_name);
        }
      }
      
      setStep("form");
    } catch (error) {
      console.error("Error validating invite:", error);
      setStep("invalid");
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password || password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsSigningUp(true);

    try {
      // Sign up the user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (signUpError) throw signUpError;

      if (!authData.user) {
        throw new Error("Failed to create user account");
      }

      // Link client to user and update invite status
      const { error: updateError } = await supabase
        .from("clients")
        .update({
          user_id: authData.user.id,
          invite_status: "ACCEPTED",
        })
        .eq("id", client.id);

      if (updateError) {
        console.error("Error linking client:", updateError);
      }

      // Notify advisor about new client signup
      try {
        await supabase.functions.invoke("notify-client-signup", {
          body: {
            clientId: client.id,
            clientName: fullName || client.name,
            advisorId: client.advisor_id,
          },
        });
        console.log("Advisor notification sent");
      } catch (notifyError) {
        console.error("Error notifying advisor:", notifyError);
        // Don't block the flow if notification fails
      }

      setStep("success");
      toast.success("Account created successfully!");
      
      // Redirect to investor dashboard after delay
      setTimeout(() => {
        navigate("/");
      }, 3000);
    } catch (error: any) {
      console.error("Error accepting invite:", error);
      toast.error(error.message || "Failed to accept invitation");
    } finally {
      setIsSigningUp(false);
    }
  };

  if (step === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Validating your invitation...</p>
        </div>
      </div>
    );
  }

  if (step === "invalid") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <Card className="w-full max-w-md backdrop-blur-sm bg-card/95 border-border/50 shadow-2xl">
          <CardContent className="pt-8 pb-6 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <XCircle className="w-8 h-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Invalid Invitation</h2>
              <p className="text-muted-foreground">
                This invitation link is invalid, expired, or has already been used.
              </p>
            </div>
            <Button onClick={() => navigate("/auth")} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <Card className="w-full max-w-md backdrop-blur-sm bg-card/95 border-border/50 shadow-2xl">
          <CardContent className="pt-8 pb-6 text-center space-y-6">
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-primary-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Welcome Aboard!</h2>
              <p className="text-muted-foreground">
                Your account has been created. Redirecting to your dashboard...
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Taking you to your dashboard
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md relative backdrop-blur-sm bg-card/95 border-border/50 shadow-2xl">
        <CardContent className="pt-8 pb-6">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">The Wheel Terminal</span>
          </div>

          {/* Welcome message */}
          <div className="text-center space-y-3 mb-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">You're Invited!</h2>
            <p className="text-muted-foreground">
              {advisorName 
                ? `${advisorName} has invited you to join The Wheel Terminal`
                : "Your advisor has invited you to join The Wheel Terminal"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleAcceptInvite} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                Full Name
              </Label>
              <Input
                id="name"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                This email was used for your invitation
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-muted-foreground" />
                Create Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Min 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isSigningUp}
            >
              {isSigningUp ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  Accept & Create Account
                  <ArrowRight className="ml-2 w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          {/* Already have account link */}
          <div className="mt-6 text-center">
            <button
              onClick={() => navigate("/auth?mode=login")}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              Already have an account? Sign in instead
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
