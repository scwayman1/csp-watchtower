import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, UserPlus, Link2, Check } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Share {
  id: string;
  shared_with_email: string;
  created_at: string;
  invite_token: string;
  accepted_at: string | null;
}

export function ShareManagement({ userId }: { userId: string }) {
  const [email, setEmail] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

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
      // Insert share record (invite_token is auto-generated)
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
        title: "Share created!",
        description: "Copy the invite link and share it with them.",
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

  const copyInviteLink = (token: string) => {
    const inviteUrl = `${window.location.origin}/accept-invite/${token}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedToken(token);
    toast({
      title: "Link copied!",
      description: "Share this link to grant dashboard access.",
    });
    setTimeout(() => setCopiedToken(null), 2000);
  };

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
        <div className="p-3 rounded-md bg-muted border border-border">
          <p className="text-sm text-muted-foreground">
            <strong>Tip:</strong> Share the invite link via text, email, or any messaging app. 
            Recipients must sign up with the invited email to gain access.
          </p>
        </div>
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
                  <div className="flex flex-col">
                    <span className="text-sm">{share.shared_with_email}</span>
                    {share.accepted_at && (
                      <span className="text-xs text-muted-foreground">
                        Accepted {new Date(share.accepted_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyInviteLink(share.invite_token)}
                      title="Copy invite link"
                    >
                      {copiedToken === share.invite_token ? (
                        <Check className="h-4 w-4 text-success" />
                      ) : (
                        <Link2 className="h-4 w-4 text-primary" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeShareMutation.mutate(share.id)}
                      disabled={removeShareMutation.isPending}
                      title="Remove access"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
