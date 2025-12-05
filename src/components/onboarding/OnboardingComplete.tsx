import { CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

interface OnboardingCompleteProps {
  userType: "investor" | "advisor";
  onContinue: () => void;
}

export function OnboardingComplete({ userType, onContinue }: OnboardingCompleteProps) {
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const nextSteps = userType === "investor" ? [
    "Import your first position from broker orders",
    "Configure your risk thresholds in Settings",
    "Explore the Learning Center to practice strategies",
  ] : [
    "Add your firm details in Settings",
    "Invite your first client to the platform",
    "Create a cycle and add model trades",
  ];

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      <div className="text-center space-y-4">
        <div className="relative w-20 h-20 mx-auto">
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
          <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-primary-foreground" />
          </div>
        </div>
        <h2 className="text-2xl font-bold">You're all set!</h2>
        <p className="text-muted-foreground">
          Your account is ready. Here's what you can do next:
        </p>
      </div>

      {showContent && (
        <div className="space-y-3">
          {nextSteps.map((step, index) => (
            <div
              key={step}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50 animate-in slide-in-from-right-4 duration-300"
              style={{ animationDelay: `${index * 150}ms` }}
            >
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <span className="text-xs font-medium text-primary">{index + 1}</span>
              </div>
              <span className="text-sm">{step}</span>
            </div>
          ))}
        </div>
      )}

      <Button onClick={onContinue} className="w-full" size="lg">
        Go to Dashboard
        <ArrowRight className="ml-2 w-4 h-4" />
      </Button>
    </div>
  );
}
