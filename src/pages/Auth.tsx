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
import { toast } from "sonner";

type OnboardingStep = "welcome" | "role" | "auth" | "complete";

const Auth = () => {
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [selectedRole, setSelectedRole] = useState<"investor" | "advisor" | null>(null);
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") || "/";
  const isDirectLogin = searchParams.get("mode") === "login";

  useEffect(() => {
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
  }, [navigate, returnUrl, isDirectLogin]);

  const steps = ["Welcome", "Role", "Account", "Complete"];
  const currentStepIndex = {
    welcome: 0,
    role: 1,
    auth: 2,
    complete: 3,
  }[step];

  const handleWelcomeContinue = () => {
    setStep("role");
  };

  const handleRoleSelect = (role: "investor" | "advisor") => {
    setSelectedRole(role);
    setStep("auth");
  };

  const handleAuthSuccess = async (userId: string) => {
    // If advisor role selected, add the role
    if (selectedRole === "advisor" && authMode === "signup") {
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

    if (authMode === "login") {
      // For login, go directly to dashboard
      navigate(returnUrl);
    } else {
      // For signup, show completion screen
      setStep("complete");
    }
  };

  const handleComplete = () => {
    if (selectedRole === "advisor") {
      navigate("/advisor");
    } else {
      navigate(returnUrl);
    }
  };

  const handleModeChange = (mode: "signup" | "login") => {
    setAuthMode(mode);
    if (mode === "login") {
      // Skip role selection for login
      setStep("auth");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
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

          {/* Progress indicator - only show for signup flow */}
          {authMode === "signup" && step !== "welcome" && (
            <OnboardingProgress
              currentStep={currentStepIndex}
              totalSteps={steps.length}
              steps={steps}
            />
          )}

          {/* Step content */}
          {step === "welcome" && (
            <WelcomeStep onContinue={handleWelcomeContinue} />
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

          {step === "complete" && selectedRole && (
            <OnboardingComplete
              userType={selectedRole}
              onContinue={handleComplete}
            />
          )}

          {/* Back button for non-login flows */}
          {step !== "welcome" && step !== "complete" && authMode === "signup" && (
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
