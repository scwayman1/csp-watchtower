import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, TrendingUp, User, Mail, Lock, CheckCircle2, XCircle, ArrowRight, Eye, EyeOff, RefreshCw, ArrowLeft } from "lucide-react";

type Step = "loading" | "invalid" | "form" | "login" | "pending_verification" | "success";

export default function AcceptClientInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<any>(null);
  const [advisorName, setAdvisorName] = useState<string>("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<Step>("loading");
  const [showPassword, setShowPassword] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);

  useEffect(() => {
    validateInvite();
  }, [token]);

  const validateInvite = async () => {
    try {
      // Use RPC function to fetch client info - bypasses RLS for invite validation
      const { data, error } = await supabase
        .rpc("get_client_by_invite_token" as any, { p_token: token });

      if (error || !data || (Array.isArray(data) && data.length === 0)) {
        console.error("Invite validation error:", error);
        setStep("invalid");
        return;
      }

      const clientData = data[0];

      if (clientData.invite_status === "ACCEPTED") {
        toast.error("This invitation has already been accepted");
        setStep("invalid");
        return;
      }

      // Client-side expiration check (server enforces too)
      if (clientData.invite_expires_at && new Date(clientData.invite_expires_at) < new Date()) {
        toast.error("This invitation has expired. Please ask your advisor to send a new one.");
        setStep("invalid");
        return;
      }

      setClient(clientData);
      setEmail(clientData.email || "");
      setFullName(clientData.name || "");

      // Try to get advisor name from profiles table
      if (clientData.advisor_id) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", clientData.advisor_id)
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

  const completeClientSignup = async (userId: string) => {
    // Call edge function to complete the client signup with service role
    const { data, error } = await supabase.functions.invoke("complete-client-signup", {
      body: {
        userId,
        clientId: client.id,
        token,
        fullName: fullName || client.name,
      },
    });

    if (error) {
      console.error("Error completing client signup:", error);
      throw new Error("Failed to link your account. Please try again.");
    }

    if (!data?.success) {
      throw new Error(data?.error || "Failed to complete signup");
    }

    // Notify advisor about new client signup (non-blocking)
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

    return data;
  };

  const handleResendVerification = async () => {
    setResendingVerification(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/accept-client-invite/${token}`,
        },
      });

      if (error) throw error;
      toast.success("Verification email sent! Check your inbox.");
    } catch (error: any) {
      console.error("Resend verification error:", error);
      toast.error(error.message || "Failed to resend verification email.");
    } finally {
      setResendingVerification(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsSubmitting(true);

    try {
      // Sign up the user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/accept-client-invite/${token}`,
        },
      });

      if (signUpError) {
        // Handle specific signup errors
        if (signUpError.message.includes("already registered")) {
          toast.error("This email is already registered. Try signing in instead.");
          setStep("login");
          return;
        }
        throw signUpError;
      }

      if (!authData.user) {
        throw new Error("Failed to create user account");
      }

      // Check if email confirmation is required
      if (authData.user.identities?.length === 0) {
        // User already exists but email not confirmed
        toast.error("This email is already registered but not confirmed. Check your inbox or resend verification.");
        setStep("pending_verification");
        return;
      }

      if (!authData.session) {
        // Email confirmation required - no session returned
        toast.success("Account created! Please check your email to verify your account.");
        setStep("pending_verification");
        return;
      }

      // Complete the client signup
      await completeClientSignup(authData.user.id);

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
      setIsSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password) {
      toast.error("Please enter your password");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Invalid email or password. Please try again.");
          return;
        }
        if (error.message.includes("Email not confirmed")) {
          toast.error("Please verify your email before signing in.");
          setStep("pending_verification");
          return;
        }
        throw error;
      }

      if (!data.user) {
        throw new Error("Login failed");
      }

      // Complete the client signup to link existing account
      await completeClientSignup(data.user.id);

      setStep("success");
      toast.success("Account linked successfully!");

      // Redirect to investor dashboard after delay
      setTimeout(() => {
        navigate("/");
      }, 3000);
    } catch (error: any) {
      console.error("Error signing in:", error);
      toast.error(error.message || "Failed to sign in");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if user returned from email verification
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user && client && step === "pending_verification") {
        try {
          await completeClientSignup(session.user.id);
          setStep("success");
          toast.success("Email verified and account linked!");
          setTimeout(() => {
            navigate("/");
          }, 3000);
        } catch (error: any) {
          console.error("Error after verification:", error);
          toast.error(error.message || "Failed to complete signup");
        }
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [client, step]);

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

  if (step === "pending_verification") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <Card className="w-full max-w-md backdrop-blur-sm bg-card/95 border-border/50 shadow-2xl">
          <CardContent className="pt-8 pb-6 space-y-6">
            <div className="text-center space-y-2">
              <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
                <Mail className="w-8 h-8 text-amber-500" />
              </div>
              <h2 className="text-2xl font-bold">Verify your email</h2>
              <p className="text-muted-foreground">
                We've sent a verification link to <strong className="text-foreground">{email}</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Please check your inbox and click the link to activate your account.
              </p>
            </div>

            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleResendVerification}
                disabled={resendingVerification}
              >
                {resendingVerification ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Resend verification email
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setStep("form")}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to sign up
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Didn't receive the email? Check your spam folder or try resending.
            </p>
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

  // Login form for existing users
  if (step === "login") {
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
                <User className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">Welcome Back!</h2>
              <p className="text-muted-foreground">
                Sign in with your existing account to accept the invitation
                {advisorName && ` from ${advisorName}`}
              </p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-4">
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-muted-foreground" />
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In & Accept Invitation
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </>
                )}
              </Button>
            </form>

            {/* Back to signup link */}
            <div className="mt-6 text-center">
              <button
                onClick={() => setStep("form")}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Don't have an account? Create one instead
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Signup form (default)
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
          <form onSubmit={handleSignUp} className="space-y-4">
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
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
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
              onClick={() => setStep("login")}
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
