import { useState, useEffect } from "react";
import { X, ArrowRight, Import, Settings, GraduationCap, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FirstTimeUserGuideProps {
  userRole: "investor" | "advisor";
  onDismiss: () => void;
  onNavigate: (path: string) => void;
}

export function FirstTimeUserGuide({ userRole, onDismiss, onNavigate }: FirstTimeUserGuideProps) {
  const [currentTip, setCurrentTip] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 500);
    return () => clearTimeout(timer);
  }, []);

  const investorTips = [
    {
      icon: Import,
      title: "Import Your First Position",
      description: "Paste broker order text to automatically parse and track your CSP positions",
      action: "Start Importing",
      path: "/",
    },
    {
      icon: GraduationCap,
      title: "Learn with the Simulator",
      description: "Practice strategies risk-free with our paper trading simulator",
      action: "Open Learning Center",
      path: "/#learning-center",
    },
    {
      icon: Settings,
      title: "Configure Your Dashboard",
      description: "Set risk thresholds, market data preferences, and portfolio settings",
      action: "Go to Settings",
      path: "/settings",
    },
  ];

  const advisorTips = [
    {
      icon: Settings,
      title: "Set Up Your Profile",
      description: "Add your firm details and configure your advisor profile",
      action: "Go to Settings",
      path: "/settings",
    },
    {
      icon: Import,
      title: "Invite Your First Client",
      description: "Send an invitation to onboard clients to the platform",
      action: "Manage Clients",
      path: "/advisor/clients",
    },
    {
      icon: MessageSquare,
      title: "Start Communicating",
      description: "Send messages to clients via app or SMS",
      action: "Open Messages",
      path: "/advisor/messages",
    },
  ];

  const tips = userRole === "investor" ? investorTips : advisorTips;

  const handleAction = () => {
    const tip = tips[currentTip];
    onNavigate(tip.path);
    if (currentTip < tips.length - 1) {
      setCurrentTip(currentTip + 1);
    } else {
      onDismiss();
    }
  };

  const handleSkip = () => {
    if (currentTip < tips.length - 1) {
      setCurrentTip(currentTip + 1);
    } else {
      onDismiss();
    }
  };

  if (!isVisible) return null;

  const CurrentIcon = tips[currentTip].icon;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="relative w-80 bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-muted">
          <div 
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((currentTip + 1) / tips.length) * 100}%` }}
          />
        </div>

        {/* Close button */}
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* Content */}
        <div className="p-5 pt-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <CurrentIcon className="w-6 h-6 text-primary" />
            </div>
            <div className="space-y-1 flex-1 pr-4">
              <p className="text-xs text-muted-foreground">
                Tip {currentTip + 1} of {tips.length}
              </p>
              <h3 className="font-semibold">{tips[currentTip].title}</h3>
              <p className="text-sm text-muted-foreground">
                {tips[currentTip].description}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="text-muted-foreground"
            >
              Skip Tour
            </Button>
            <div className="flex items-center gap-2 ml-auto">
              {currentTip < tips.length - 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSkip}
                >
                  Next
                </Button>
              )}
              <Button size="sm" onClick={handleAction}>
                {tips[currentTip].action}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>

          {/* Dots indicator */}
          <div className="flex items-center justify-center gap-1.5 mt-4">
            {tips.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentTip(index)}
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all",
                  index === currentTip 
                    ? "bg-primary w-4" 
                    : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
