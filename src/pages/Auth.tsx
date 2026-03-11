import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { OnboardingProgress } from "@/components/onboarding/OnboardingProgress";
import { WelcomeStep } from "@/components/onboarding/WelcomeStep";
import { RoleSelectionStep } from "@/components/onboarding/RoleSelectionStep";
import { AuthStep } from "@/components/onboarding/AuthStep";
import { OnboardingComplete } from "@/components/onboarding/OnboardingComplete";
import { UpdatePasswordStep } from "@/components/onboarding/UpdatePasswordStep";
import { toast } from "sonner";

type OnboardingStep = "welcome" | "role" | "auth" | "complete" | "update-password";

const Auth = () => {
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [selectedRole, setSelectedRole] = useState<"investor" | "advisor" | null>(null);
  const [authMode, setAuthMode] = useState<"signup" | "login" | "reset">("signup");
  // Track whether a recovery session has been confirmed
  const [recoverySessionReady, setRecoverySessionReady] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") || "/";
  const isDirectLogin = searchParams.get("mode") === "login";
  const isPasswordReset = searchParams.get("reset") === "true";

  useEffect(() => {
    // Listen for auth state changes — this catches the hash-fragment recovery token
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[Auth] onAuthStateChange:", event, !!session);
      if (event === "PASSWORD_RECOVERY" && session) {
        setRecoverySessionReady(true);
        setStep("update-password");
      }
      // When on the reset page, accept any session-establishing event
      // (PASSWORD_RECOVERY may fire as INITIAL_SESSION or SIGNED_IN
      // if the hash was already processed before this listener registered)
      if (isPasswordReset && session && (event === "INITIAL_SESSION" || event === "SIGNED_IN")) {
        setRecoverySessionReady(true);
        setStep("update-password");
      }
    });

    if (isPasswordReset) {
      setStep("update-password");
      // Poll for session — the hash fragment is processed asynchronously
      // and may complete before or after the listener above fires
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setRecoverySessionReady(true);
          clearInterval(poll);
        } else if (attempts >= 20) {
          // After ~10 seconds, stop polling
          clearInterval(poll);
        }
      }, 500);
      return () => {
        subscription.unsubscribe();
        clearInterval(poll);
      };
    }

    // Check if user is already authenticated
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        navigate(returnUrl);
      }
    };
    checkAuth();

    // If direct login mode, skip to auth step
    if (isDirectLogin) {
      setStep("auth");
      setAuthMode("login");
    }

    return () => subscription.unsubscribe();
  }, [navigate, returnUrl, isDirectLogin, isPasswordReset]);

  const steps = ["Welcome", "Role", "Account", "Complete"];
  const currentStepIndex = {
    welcome: 0,
    role: 1,
    auth: 2,
    complete: 3,
    "update-password": 2,
  }[step];

  const handleWelcomeContinue = () => {
    setStep("role");
  };

  const handleWelcomeSignIn = () => {
    setAuthMode("login");
    setStep("auth");
  };

  const handleRoleSelect = (role: "investor" | "advisor") => {
    setSelectedRole(role);
    setStep("auth");
  };

  const handleAuthSuccess = async (userId: string) => {
    if (authMode === "signup") {
      if (selectedRole === "advisor") {
        try {
          const { error } = await supabase
            .from("user_roles")
            .insert({ user_id: userId, role: "advisor" });
          
          if (error && !error.message.includes("duplicate")) {
            console.error("Error adding advisor role:", error);
          }
        } catch (err) {
          console.error("Error adding advisor role:", err);
        }
      }
      setStep("complete");
    } else {
      navigate(returnUrl);
    }
  };

  const handleComplete = () => {
    if (selectedRole === "advisor") {
      navigate("/advisor");
    } else {
      navigate(returnUrl);
    }
  };

  const handleModeChange = (mode: "signup" | "login" | "reset") => {
    setAuthMode(mode);
    if (mode === "login" || mode === "reset") {
      setStep("auth");
    }
  };

  const handlePasswordUpdateSuccess = () => {
    toast.success("Your password has been updated. You can now sign in.");
    setStep("auth");
    setAuthMode("login");
    navigate("/auth", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md relative backdrop-blur-sm bg-card/95 border-border/50 shadow-2xl">
        <CardContent className="pt-8 pb-6">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">The Wheel Terminal</span>
          </div>

          {authMode === "signup" && step !== "welcome" && step !== "update-password" && (
            <OnboardingProgress
              currentStep={currentStepIndex}
              totalSteps={steps.length}
              steps={steps}
            />
          )}

          {step === "welcome" && (
            <WelcomeStep onContinue={handleWelcomeContinue} onSignIn={handleWelcomeSignIn} />
          )}

          {step === "role" && (
            <RoleSelectionStep
              selectedRole={selectedRole}
              onSelectRole={handleRoleSelect}
            />
          )}

          {step === "auth" && (
            <AuthStep
              mode={authMode}
              onModeChange={handleModeChange}
              onSuccess={handleAuthSuccess}
              returnUrl={returnUrl}
            />
          )}

          {step === "update-password" && (
            <UpdatePasswordStep
              onSuccess={handlePasswordUpdateSuccess}
              sessionReady={recoverySessionReady}
            />
          )}

          {step === "complete" && selectedRole && (
            <OnboardingComplete
              userType={selectedRole}
              onContinue={handleComplete}
            />
          )}

          {step !== "welcome" && step !== "complete" && step !== "update-password" && authMode === "signup" && (
            <button
              onClick={() => {
                if (step === "role") setStep("welcome");
                if (step === "auth") setStep("role");
              }}
              className="mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors w-full text-center"
            >
              ← Go back
            </button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
