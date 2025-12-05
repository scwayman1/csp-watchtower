import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";

const ONBOARDING_COMPLETED_KEY = "wheel_terminal_onboarding_completed";

export function useOnboarding() {
  const { user } = useAuth();
  const [showGuide, setShowGuide] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check onboarding status on mount
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const checkOnboardingStatus = async () => {
      try {
        // First check localStorage for quick response
        const localCompleted = JSON.parse(localStorage.getItem(ONBOARDING_COMPLETED_KEY) || "[]");
        if (localCompleted.includes(user.id)) {
          setShowGuide(false);
          setIsLoading(false);
          return;
        }

        // Check database for onboarding_completed flag in profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("bio")
          .eq("user_id", user.id)
          .single();

        // Use bio field existence as a proxy for "has interacted with profile"
        // Or check localStorage - if neither, show guide
        const hasCompletedOnboarding = localCompleted.includes(user.id);
        
        if (!hasCompletedOnboarding) {
          // Delay showing guide to let dashboard load
          setTimeout(() => {
            setShowGuide(true);
            setIsLoading(false);
          }, 1500);
        } else {
          setShowGuide(false);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error checking onboarding status:", error);
        setIsLoading(false);
      }
    };

    checkOnboardingStatus();
  }, [user]);

  const dismissGuide = useCallback(() => {
    if (user) {
      // Save to localStorage immediately
      const completedUsers = JSON.parse(localStorage.getItem(ONBOARDING_COMPLETED_KEY) || "[]");
      if (!completedUsers.includes(user.id)) {
        completedUsers.push(user.id);
        localStorage.setItem(ONBOARDING_COMPLETED_KEY, JSON.stringify(completedUsers));
      }
    }
    setShowGuide(false);
  }, [user]);

  const resetOnboarding = useCallback(() => {
    if (user) {
      // Remove from localStorage
      const completedUsers = JSON.parse(localStorage.getItem(ONBOARDING_COMPLETED_KEY) || "[]");
      const filtered = completedUsers.filter((id: string) => id !== user.id);
      localStorage.setItem(ONBOARDING_COMPLETED_KEY, JSON.stringify(filtered));
      
      // Show guide again
      setShowGuide(true);
    }
  }, [user]);

  return {
    showGuide: !isLoading && showGuide,
    dismissGuide,
    resetOnboarding,
    isLoading,
  };
}
