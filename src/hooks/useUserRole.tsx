import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "investor" | "advisor" | "admin";

// Priority order for default role selection
const ROLE_PRIORITY: AppRole[] = ["investor", "advisor", "admin"];

interface UserRoleContextType {
  roles: AppRole[];
  activeRole: AppRole;
  loading: boolean;
  switching: boolean;
  switchRole: (role: AppRole) => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  fetchUserRoles: () => Promise<void>;
  isAdvisor: boolean;
  isInvestor: boolean;
}

const UserRoleContext = createContext<UserRoleContextType | null>(null);

export function UserRoleProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [activeRole, setActiveRole] = useState<AppRole>("investor");

  const fetchUserRoles = useCallback(async (retryCount = 0) => {
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
  }, []);

  useEffect(() => {
    fetchUserRoles();
  }, [fetchUserRoles]);

  const switchRole = useCallback(async (role: AppRole) => {
    console.log("switchRole called:", { role, activeRole, roles });

    if (!roles.includes(role)) {
      console.warn("Role not available:", role);
      return;
    }

    // Show switching state
    setSwitching(true);

    try {
      // Clear all React Query cache to force fresh data for new role
      await queryClient.cancelQueries();
      queryClient.clear();

      // Update state
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
      // Small delay to allow navigation and re-render
      setTimeout(() => setSwitching(false), 100);
    }
  }, [roles, activeRole, location.pathname, navigate, queryClient]);

  const hasRole = useCallback((role: AppRole) => roles.includes(role), [roles]);

  const value: UserRoleContextType = {
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

  return (
    <UserRoleContext.Provider value={value}>
      {children}
    </UserRoleContext.Provider>
  );
}

export function useUserRole(): UserRoleContextType {
  const context = useContext(UserRoleContext);
  if (!context) {
    throw new Error("useUserRole must be used within a UserRoleProvider");
  }
  return context;
}
