import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "investor" | "advisor" | "admin";

export function useUserRole() {
  const navigate = useNavigate();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRole] = useState<AppRole>("investor");
  const [switching, setSwitching] = useState(false);

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
    console.log("switchRole called with:", role, "current activeRole:", activeRole);
    
    if (!roles.includes(role)) {
      console.log("Role not in user's roles:", roles);
      return;
    }
    
    if (role === activeRole) {
      console.log("Already on this role, skipping");
      return;
    }
    
    setSwitching(true);
    setActiveRole(role);
    localStorage.setItem("activeRole", role);
    
    // Navigate to appropriate route based on new role
    const currentPath = window.location.pathname;
    console.log("Current path:", currentPath, "switching to role:", role);
    
    if (role === "investor") {
      if (currentPath.startsWith("/advisor")) {
        if (currentPath === "/advisor/settings") {
          navigate("/settings", { replace: true });
        } else {
          navigate("/", { replace: true });
        }
      }
    } else if (role === "advisor" || role === "admin") {
      if (currentPath === "/settings") {
        navigate("/advisor/settings", { replace: true });
      } else if (!currentPath.startsWith("/advisor")) {
        navigate("/advisor", { replace: true });
      }
    }
    
    setSwitching(false);
  };

  const hasRole = (role: AppRole) => roles.includes(role);

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
