import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "investor" | "advisor" | "admin";

// Priority order for default role selection
const ROLE_PRIORITY: AppRole[] = ["investor", "advisor", "admin"];

export function useUserRole() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [activeRole, setActiveRole] = useState<AppRole>("investor");

  useEffect(() => {
    fetchUserRoles();
  }, []);

  const fetchUserRoles = async (retryCount = 0) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (error) throw error;

      const userRoles = data?.map(r => r.role as AppRole) || [];
      
      // If no roles found, try to repair user data
      if (userRoles.length === 0) {
        console.warn("No roles found for user, attempting repair...");
        
        // Call repair endpoint
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            const { data: repairData } = await supabase.functions.invoke('repair-user-data', {
              headers: {
                Authorization: `Bearer ${session.access_token}`
              }
            });
            
            console.log("Repair result:", repairData);
            
            // Retry fetching roles after repair (max 2 retries)
            if (retryCount < 2) {
              await new Promise(resolve => setTimeout(resolve, 500));
              return fetchUserRoles(retryCount + 1);
            }
          }
        } catch (repairError) {
          console.error("Failed to repair user data:", repairError);
        }
        
        // Fallback to investor role
        setRoles(["investor"]);
        setActiveRole("investor");
        localStorage.setItem("activeRole", "investor");
        setLoading(false);
        return;
      }
      
      setRoles(userRoles);
      
      // Check localStorage for saved role preference
      const savedRole = localStorage.getItem("activeRole") as AppRole;
      if (savedRole && userRoles.includes(savedRole)) {
        setActiveRole(savedRole);
      } else {
        // Default to highest priority role the user has (investor > advisor > admin)
        const defaultRole = ROLE_PRIORITY.find(r => userRoles.includes(r)) || "investor";
        setActiveRole(defaultRole);
        localStorage.setItem("activeRole", defaultRole);
      }
    } catch (error) {
      console.error("Error fetching user roles:", error);
      setRoles(["investor"]);
      setActiveRole("investor");
    } finally {
      setLoading(false);
    }
  };

  const switchRole = useCallback(async (role: AppRole) => {
    console.log("switchRole called:", { role, activeRole, roles });

    if (!roles.includes(role)) {
      console.warn("Role not available:", role);
      return;
    }

    // Set switching state to show loading UI
    setSwitching(true);

    try {
      // Clear ALL React Query caches to ensure fresh data for new role
      // This is critical - without this, stale data from the previous role persists
      await queryClient.cancelQueries();
      queryClient.clear();

      // Update role state and localStorage
      setActiveRole(role);
      localStorage.setItem("activeRole", role);

      // Navigate based on role
      const currentPath = location.pathname;

      if (role === "investor") {
        // Switch to investor routes
        if (currentPath.startsWith("/advisor")) {
          if (currentPath === "/advisor/settings") {
            navigate("/settings", { replace: true });
          } else if (currentPath === "/advisor/messages") {
            navigate("/messages", { replace: true });
          } else {
            navigate("/", { replace: true });
          }
        }
      } else {
        // Switch to advisor/admin routes
        if (!currentPath.startsWith("/advisor")) {
          if (currentPath === "/settings") {
            navigate("/advisor/settings", { replace: true });
          } else if (currentPath === "/messages") {
            navigate("/advisor/messages", { replace: true });
          } else {
            navigate("/advisor", { replace: true });
          }
        }
      }
    } finally {
      // Small delay to let navigation complete before removing loading state
      setTimeout(() => setSwitching(false), 100);
    }
  }, [roles, activeRole, location.pathname, navigate, queryClient]);

  const hasRole = useCallback((role: AppRole) => roles.includes(role), [roles]);

  return {
    roles,
    activeRole,
    loading,
    switching,
    switchRole,
    hasRole,
    fetchUserRoles,
    isAdvisor: activeRole === "advisor" || activeRole === "admin",
    isInvestor: activeRole === "investor",
  };
}
