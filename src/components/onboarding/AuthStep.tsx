import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AuthStepProps {
  mode: "signup" | "login";
  onModeChange: (mode: "signup" | "login") => void;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
            toast.error("Please check your email to confirm your account.");
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

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h2>
        <p className="text-muted-foreground">
          {mode === "signup" 
            ? "Enter your details to get started"
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

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
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

        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {mode === "signup" ? "Creating account..." : "Signing in..."}
            </>
          ) : (
            mode === "signup" ? "Create Account" : "Sign In"
          )}
        </Button>
      </form>

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
    </div>
  );
}
