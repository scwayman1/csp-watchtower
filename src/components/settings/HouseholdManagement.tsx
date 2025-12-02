import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Trash2, UserPlus, Copy, AlertCircle } from "lucide-react";

export function HouseholdManagement() {
  const [memberUserId, setMemberUserId] = useState("");
  const [relationship, setRelationship] = useState("Spouse");
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const { data: members, isLoading } = useQuery({
    queryKey: ["household-members"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("household_members")
        .select("*")
        .or(`primary_user_id.eq.${user.id},member_user_id.eq.${user.id}`);

      if (error) throw error;
      return data || [];
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async ({ userId, rel }: { userId: string; rel: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("household_members")
        .insert({
          primary_user_id: user.id,
          member_user_id: userId,
          relationship: rel,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["household-members"] });
      toast.success("Household member linked successfully! Both accounts now share portfolio data.");
      setMemberUserId("");
      setRelationship("Spouse");
    },
    onError: (error: Error) => {
      toast.error(`Failed to link member: ${error.message}`);
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from("household_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["household-members"] });
      toast.success("Household member removed");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleAddMember = async () => {
    if (!memberUserId.trim()) {
      toast.error("Please enter the member's User ID");
      return;
    }
    addMemberMutation.mutate({ userId: memberUserId, rel: relationship });
  };

  const copyUserId = () => {
    if (currentUser?.id) {
      navigator.clipboard.writeText(currentUser.id);
      toast.success("Your User ID copied to clipboard");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Joint Account - Household Members</CardTitle>
        <CardDescription>
          Link family members to share complete portfolio access. Both accounts will see identical positions, assigned shares, and all data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Your User ID */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="space-y-2">
            <p className="font-semibold">Your User ID:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 bg-muted rounded text-xs font-mono break-all">
                {currentUser?.id || "Loading..."}
              </code>
              <Button size="sm" variant="outline" onClick={copyUserId}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Share this ID with your spouse/partner so they can link their account to yours.
            </p>
          </AlertDescription>
        </Alert>

        {/* Add Member Form */}
        <div className="space-y-4 p-4 border rounded-lg">
          <div className="space-y-2">
            <Label htmlFor="member-id">Link Household Member by Their User ID</Label>
            <Input
              id="member-id"
              type="text"
              placeholder="Paste their User ID here"
              value={memberUserId}
              onChange={(e) => setMemberUserId(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="relationship">Relationship</Label>
            <Input
              id="relationship"
              type="text"
              placeholder="e.g., Spouse, Partner"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
            />
          </div>
          <Button onClick={handleAddMember} disabled={addMemberMutation.isPending} className="w-full">
            <UserPlus className="w-4 h-4 mr-2" />
            {addMemberMutation.isPending ? "Linking..." : "Link Member"}
          </Button>
        </div>

        {/* Current Members */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading household members...</p>
        ) : members && members.length > 0 ? (
          <div className="space-y-2">
            <Label>Currently Linked Members</Label>
            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{member.relationship || "Family Member"}</p>
                    <p className="text-xs text-muted-foreground font-mono">{member.member_user_id}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeMemberMutation.mutate(member.id)}
                    disabled={removeMemberMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <Alert>
            <AlertDescription className="text-sm">
              <p className="font-semibold mb-1">No household members linked yet.</p>
              <p className="text-xs text-muted-foreground">
                To link accounts: 1) Copy your User ID above, 2) Have your spouse/partner paste it in their settings, 3) They click "Link Member"
              </p>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
