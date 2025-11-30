import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "investor" | "advisor" | "admin";

export function useUserRole() {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRole] = useState<AppRole>("investor");

  useEffect(() => {
    fetchUserRoles();
  }, []);

  const fetchUserRoles = async () => {
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

      const userRoles = data?.map(r => r.role as AppRole) || ["investor"];
      setRoles(userRoles);
      
      // Set active role from localStorage or default to first role
      const savedRole = localStorage.getItem("activeRole") as AppRole;
      if (savedRole && userRoles.includes(savedRole)) {
        setActiveRole(savedRole);
      } else if (userRoles.length > 0) {
        setActiveRole(userRoles[0]);
      }
    } catch (error) {
      console.error("Error fetching user roles:", error);
      setRoles(["investor"]); // Default to investor
    } finally {
      setLoading(false);
    }
  };

  const switchRole = (role: AppRole) => {
    if (roles.includes(role)) {
      setActiveRole(role);
      localStorage.setItem("activeRole", role);
    }
  };

  const hasRole = (role: AppRole) => roles.includes(role);

  return {
    roles,
    activeRole,
    loading,
    switchRole,
    hasRole,
    fetchUserRoles,
    isAdvisor: activeRole === "advisor" || activeRole === "admin",
    isInvestor: activeRole === "investor",
  };
}
