import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, UserPlus, Mail } from "lucide-react";
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
  const [emailWarningDismissed, setEmailWarningDismissed] = useState(false);

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
      // Get current user email
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("User not authenticated");

      // Insert share record
      const { error } = await supabase
        .from("position_shares")
        .insert({
          owner_id: userId,
          shared_with_email: emailToShare,
        });

      if (error) throw error;

      // Send invitation email
      const appUrl = window.location.origin;
      const { error: emailError } = await supabase.functions.invoke('send-invite-email', {
        body: {
          inviterEmail: user.email,
          recipientEmail: emailToShare,
          appUrl,
        },
      });

      if (emailError) {
        console.error("Failed to send invitation email:", emailError);
        toast({
          title: "Share created (email not sent)",
          description: "Access granted, but email requires domain verification. Contact them manually.",
          variant: "default",
        });
        return;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["position-shares"] });
      setEmail("");
      toast({
        title: "Invitation sent!",
        description: "They'll receive an email with instructions to view your dashboard.",
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

  const resendInviteMutation = useMutation({
    mutationFn: async (recipientEmail: string) => {
      // Get current user email
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("User not authenticated");

      // Send invitation email
      const appUrl = window.location.origin;
      const { error } = await supabase.functions.invoke('send-invite-email', {
        body: {
          inviterEmail: user.email,
          recipientEmail,
          appUrl,
        },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Invitation resent!",
        description: "The invitation email has been sent again.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send invitation",
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
        {!emailWarningDismissed && (
          <div className="p-3 rounded-md bg-muted border border-border">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> Email invitations require domain verification with Resend. 
                For now, share access is granted but users must be notified manually to sign up with their invited email.
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEmailWarningDismissed(true)}
                className="shrink-0"
              >
                ✕
              </Button>
            </div>
          </div>
        )}
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
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => resendInviteMutation.mutate(share.shared_with_email)}
                      disabled={resendInviteMutation.isPending}
                      title="Resend invitation email"
                    >
                      <Mail className="h-4 w-4 text-primary" />
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
