import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";

const ONBOARDING_COMPLETED_KEY = "wheel_terminal_onboarding_completed";

export function useOnboarding() {
  const { user } = useAuth();
  const [showGuide, setShowGuide] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    if (user && !hasChecked) {
      // Check if user has completed onboarding
      const completedUsers = JSON.parse(localStorage.getItem(ONBOARDING_COMPLETED_KEY) || "[]");
      const hasCompleted = completedUsers.includes(user.id);
      
      if (!hasCompleted) {
        // Small delay to let the dashboard load first
        const timer = setTimeout(() => {
          setShowGuide(true);
        }, 1500);
        return () => clearTimeout(timer);
      }
      
      setHasChecked(true);
    }
  }, [user, hasChecked]);

  const dismissGuide = () => {
    if (user) {
      const completedUsers = JSON.parse(localStorage.getItem(ONBOARDING_COMPLETED_KEY) || "[]");
      if (!completedUsers.includes(user.id)) {
        completedUsers.push(user.id);
        localStorage.setItem(ONBOARDING_COMPLETED_KEY, JSON.stringify(completedUsers));
      }
    }
    setShowGuide(false);
  };

  const resetOnboarding = () => {
    if (user) {
      const completedUsers = JSON.parse(localStorage.getItem(ONBOARDING_COMPLETED_KEY) || "[]");
      const filtered = completedUsers.filter((id: string) => id !== user.id);
      localStorage.setItem(ONBOARDING_COMPLETED_KEY, JSON.stringify(filtered));
      setShowGuide(true);
      setHasChecked(false);
    }
  };

  return {
    showGuide,
    dismissGuide,
    resetOnboarding,
  };
}
