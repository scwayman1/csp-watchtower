import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";

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
        // Check database for onboarding_completed_at
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("onboarding_completed_at")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Error checking onboarding status:", error);
          setIsLoading(false);
          return;
        }

        const hasCompletedOnboarding = !!profile?.onboarding_completed_at;
        
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

  const dismissGuide = useCallback(async () => {
    setShowGuide(false);
    
    if (user) {
      // Save completion to database
      const { error } = await supabase
        .from("profiles")
        .update({ onboarding_completed_at: new Date().toISOString() })
        .eq("user_id", user.id);

      if (error) {
        console.error("Error saving onboarding status:", error);
      }
    }
  }, [user]);

  const resetOnboarding = useCallback(async () => {
    if (user) {
      // Clear completion in database
      const { error } = await supabase
        .from("profiles")
        .update({ onboarding_completed_at: null })
        .eq("user_id", user.id);

      if (error) {
        console.error("Error resetting onboarding status:", error);
        return;
      }
      
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
