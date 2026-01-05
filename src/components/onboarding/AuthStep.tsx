import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Eye, EyeOff, ArrowLeft, Mail, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AuthStepProps {
  mode: "signup" | "login" | "reset";
  onModeChange: (mode: "signup" | "login" | "reset") => void;
  onSuccess: (userId: string) => void;
  email?: string;
  disableEmailEdit?: boolean;
  returnUrl?: string;
}

export function AuthStep({ 
  mode, 
  onModeChange, 
  onSuccess, 
  email: initialEmail = "", 
  disableEmailEdit = false,
  returnUrl = "/"
}: AuthStepProps) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);

  // Call repair endpoint to ensure user data is complete
  const repairUserData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await supabase.functions.invoke('repair-user-data', {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });
      }
    } catch (error) {
      console.warn('User data repair check failed:', error);
      // Non-fatal - continue with login
    }
  };

  const handleResendVerification = async () => {
    setResendingVerification(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}${returnUrl}`,
        }
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

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?reset=true`,
      });

      if (error) throw error;

      toast.success("Password reset email sent! Check your inbox.");
      setResetSent(true);
    } catch (error: any) {
      console.error("Password reset error:", error);
      toast.error(error.message || "Failed to send reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode === "reset") {
      return handlePasswordReset(e);
    }
    
    setLoading(true);

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}${returnUrl}`,
          },
        });

        if (error) {
          // Handle specific signup errors
          if (error.message.includes('already registered')) {
            toast.error("This email is already registered. Try signing in instead.");
            onModeChange("login");
            return;
          }
          throw error;
        }
        
        if (data.user) {
          // Check if email confirmation is required
          if (data.user.identities?.length === 0) {
            // User already exists but email not confirmed
            toast.error("This email is already registered but not confirmed. Check your inbox or resend verification.");
            setPendingVerification(true);
            return;
          }
          
          if (!data.session) {
            // Email confirmation required - no session returned
            toast.success("Account created! Please check your email to verify your account.");
            setPendingVerification(true);
            return;
          }
          
          // Give the trigger a moment to run, then verify/repair data
          await new Promise(resolve => setTimeout(resolve, 500));
          await repairUserData();
          toast.success("Account created successfully!");
          onSuccess(data.user.id);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          // Handle specific login errors with friendly messages
          if (error.message.includes('Invalid login credentials')) {
            toast.error("Invalid email or password. Please try again.");
            return;
          }
          if (error.message.includes('Email not confirmed')) {
            toast.error("Please verify your email before signing in.");
            setPendingVerification(true);
            return;
          }
          throw error;
        }
        
        if (data.user) {
          // Repair any missing user data on login
          await repairUserData();
          toast.success("Welcome back!");
          onSuccess(data.user.id);
        }
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      toast.error(error.message || "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Email verification pending view
  if (pendingVerification) {
    return (
      <div className="space-y-6 animate-in fade-in-50 duration-500">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
            <Mail className="w-6 h-6 text-amber-500" />
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
            onClick={() => {
              setPendingVerification(false);
              onModeChange("login");
            }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to sign in
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Didn't receive the email? Check your spam folder or try resending.
        </p>
      </div>
    );
  }

  // Reset password sent confirmation view
  if (mode === "reset" && resetSent) {
    return (
      <div className="space-y-6 animate-in fade-in-50 duration-500">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold">Check your email</h2>
          <p className="text-muted-foreground">
            We've sent a password reset link to <strong>{email}</strong>
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => {
            setResetSent(false);
            onModeChange("login");
          }}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      <div className="text-center space-y-2">
        {mode === "reset" && (
          <button
            type="button"
            onClick={() => onModeChange("login")}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-2"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to sign in
          </button>
        )}
        <h2 className="text-2xl font-bold">
          {mode === "signup" 
            ? "Create your account" 
            : mode === "reset" 
              ? "Reset your password" 
              : "Welcome back"}
        </h2>
        <p className="text-muted-foreground">
          {mode === "signup" 
            ? "Enter your details to get started"
            : mode === "reset"
              ? "Enter your email and we'll send you a reset link"
              : "Sign in to continue to your dashboard"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "signup" && (
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              placeholder="Enter your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={disableEmailEdit}
            className={disableEmailEdit ? "bg-muted" : ""}
            autoComplete="email"
          />
        </div>

        {mode !== "reset" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => onModeChange("reset")}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder={mode === "signup" ? "Create a password (min 6 characters)" : "Enter your password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
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
        )}

        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {mode === "signup" 
                ? "Creating account..." 
                : mode === "reset" 
                  ? "Sending reset link..."
                  : "Signing in..."}
            </>
          ) : (
            mode === "signup" 
              ? "Create Account" 
              : mode === "reset"
                ? "Send Reset Link"
                : "Sign In"
          )}
        </Button>
      </form>

      {mode !== "reset" && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => onModeChange(mode === "signup" ? "login" : "signup")}
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            {mode === "signup" 
              ? "Already have an account? Sign in"
              : "Don't have an account? Sign up"}
          </button>
        </div>
      )}
    </div>
  );
}
