import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, UserPlus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Share {
  id: string;
  shared_with_email: string;
  created_at: string;
}

export function ShareManagement({ userId }: { userId: string }) {
  const [email, setEmail] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: shares = [], isLoading } = useQuery({
    queryKey: ["position-shares", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("position_shares")
        .select("*")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Share[];
    },
  });

  const addShareMutation = useMutation({
    mutationFn: async (emailToShare: string) => {
      const { error } = await supabase
        .from("position_shares")
        .insert({
          owner_id: userId,
          shared_with_email: emailToShare,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["position-shares"] });
      setEmail("");
      toast({
        title: "Dashboard shared",
        description: "They'll be able to view your positions once they sign up or log in.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to share",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeShareMutation = useMutation({
    mutationFn: async (shareId: string) => {
      const { error } = await supabase
        .from("position_shares")
        .delete()
        .eq("id", shareId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["position-shares"] });
      toast({
        title: "Access removed",
        description: "User can no longer view your dashboard.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove access",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleShare = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    addShareMutation.mutate(email);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Share Your Dashboard</CardTitle>
        <CardDescription>
          Give read-only access to your positions dashboard with advisors, family members, or anyone you trust.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleShare} className="flex gap-2">
          <Input
            type="email"
            placeholder="advisor@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={addShareMutation.isPending}
          />
          <Button type="submit" disabled={addShareMutation.isPending}>
            <UserPlus className="h-4 w-4 mr-2" />
            Share
          </Button>
        </form>

        <div className="space-y-2">
          <h4 className="text-sm font-medium">Shared with:</h4>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : shares.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not shared with anyone yet.</p>
          ) : (
            <div className="space-y-2">
              {shares.map((share) => (
                <div
                  key={share.id}
                  className="flex items-center justify-between p-2 rounded-md bg-muted"
                >
                  <span className="text-sm">{share.shared_with_email}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeShareMutation.mutate(share.id)}
                    disabled={removeShareMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
