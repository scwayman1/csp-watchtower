import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Shield, Briefcase, User2, Crown } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function RoleManager() {
  const { roles, fetchUserRoles, hasRole } = useUserRole();
  const [adding, setAdding] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);
  const { toast } = useToast();

  const availableRoles = [
    { value: "investor", label: "Investor", icon: User2, description: "Personal portfolio tracking" },
    { value: "advisor", label: "Advisor", icon: Briefcase, description: "Manage clients and allocations" },
    { value: "admin", label: "Admin", icon: Shield, description: "Full system access" },
  ];

  const bootstrapAdmin = async () => {
    setBootstrapping(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Call edge function to bootstrap admin (bypasses RLS)
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bootstrap-admin`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: user.id }),
      });

      if (!response.ok) throw new Error('Failed to bootstrap admin');

      toast({
        title: "Success!",
        description: "You are now the admin. Refresh the page to see changes.",
      });

      // Refresh roles
      setTimeout(() => {
        if (fetchUserRoles) fetchUserRoles();
        window.location.reload();
      }, 1000);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to bootstrap admin",
        variant: "destructive",
      });
    } finally {
      setBootstrapping(false);
    }
  };

  const addRole = async (role: string) => {
    setAdding(role);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("user_roles")
        .insert([{ user_id: user.id, role: role as any }]);

      if (error) throw error;

      toast({
        title: "Role Added",
        description: `${role.charAt(0).toUpperCase() + role.slice(1)} role has been added to your account`,
      });

      // Refresh roles
      if (fetchUserRoles) fetchUserRoles();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add role",
        variant: "destructive",
      });
    } finally {
      setAdding(null);
    }
  };

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader>
        <CardTitle>Role Management</CardTitle>
        <CardDescription>
          Add roles to access different parts of the application. You need multiple roles to see the role switcher.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasRole("admin") && roles.length === 0 && (
          <Alert className="border-primary/50 bg-primary/5">
            <Crown className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">First time setup required</p>
                <p className="text-sm text-muted-foreground">
                  Click below to make yourself the admin. This bypasses RLS for initial setup.
                </p>
                <Button 
                  onClick={bootstrapAdmin} 
                  disabled={bootstrapping}
                  className="mt-2"
                >
                  {bootstrapping ? "Setting up..." : "Make Me Admin"}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
        {availableRoles.map((role) => {
          const hasRole = roles.includes(role.value as any);
          const Icon = role.icon;
          
          return (
            <div key={role.value} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background/50">
              <div className="flex items-center gap-3">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{role.label}</span>
                    {hasRole && <Badge variant="secondary">Active</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{role.description}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant={hasRole ? "outline" : "default"}
                onClick={() => addRole(role.value)}
                disabled={hasRole || adding === role.value}
              >
                {adding === role.value ? "Adding..." : hasRole ? "Added" : "Add Role"}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
