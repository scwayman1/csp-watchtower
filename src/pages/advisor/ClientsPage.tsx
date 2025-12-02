import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Mail, TrendingUp, DollarSign, Eye } from "lucide-react";
import { toast } from "sonner";

export default function ClientsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    name: "",
    email: "",
    risk_level: "MODERATE",
    segment: "",
    notes: "",
  });

  // Fetch clients
  const { data: clients, isLoading } = useQuery({
    queryKey: ["advisor-clients"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("advisor_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Create client and send invitation
  const createClientMutation = useMutation({
    mutationFn: async (clientData: typeof newClient) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Fetch advisor profile for name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .single();

      // Create client record
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .insert({
          advisor_id: user.id,
          name: clientData.name,
          email: clientData.email,
          risk_level: clientData.risk_level,
          segment: clientData.segment || null,
          notes: clientData.notes || null,
          invite_status: "PENDING",
        })
        .select()
        .single();

      if (clientError) throw clientError;

      // Send invitation email
      const { error: inviteError } = await supabase.functions.invoke("send-client-invite", {
        body: {
          clientId: client.id,
          clientName: clientData.name,
          clientEmail: clientData.email,
          advisorName: profile?.full_name || "Your Advisor",
        },
      });

      if (inviteError) {
        console.error("Error sending invitation:", inviteError);
        toast.error("Client created but invitation email failed to send");
      }

      return client;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advisor-clients"] });
      setIsInviteDialogOpen(false);
      setNewClient({
        name: "",
        email: "",
        risk_level: "MODERATE",
        segment: "",
        notes: "",
      });
      toast.success("Client invited successfully! They will receive an email.");
    },
    onError: (error: Error) => {
      toast.error(`Failed to invite client: ${error.message}`);
    },
  });

  const handleInviteClient = () => {
    if (!newClient.name || !newClient.email) {
      toast.error("Name and email are required");
      return;
    }
    createClientMutation.mutate(newClient);
  };

  // Resend invitation
  const resendInviteMutation = useMutation({
    mutationFn: async (client: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .single();

      const { error } = await supabase.functions.invoke("send-client-invite", {
        body: {
          clientId: client.id,
          clientName: client.name,
          clientEmail: client.email,
          advisorName: profile?.full_name || "Your Advisor",
        },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invitation resent successfully!");
    },
    onError: (error: Error) => {
      toast.error(`Failed to resend invitation: ${error.message}`);
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "success" | "secondary"> = {
      PENDING: "secondary",
      ACCEPTED: "success",
      EXPIRED: "default",
    };
    return (
      <Badge variant={variants[status] || "default"}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Clients</h1>
          <p className="text-muted-foreground">Manage your client relationships</p>
        </div>
        <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              Invite Client
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Invite New Client</DialogTitle>
              <DialogDescription>
                Send an invitation to a new client to join The Wheel Terminal
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Client Name *</Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={newClient.name}
                  onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={newClient.email}
                  onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="risk_level">Risk Level</Label>
                <Select
                  value={newClient.risk_level}
                  onValueChange={(value) => setNewClient({ ...newClient, risk_level: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CONSERVATIVE">Conservative</SelectItem>
                    <SelectItem value="MODERATE">Moderate</SelectItem>
                    <SelectItem value="AGGRESSIVE">Aggressive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="segment">Segment (Optional)</Label>
                <Input
                  id="segment"
                  placeholder="e.g., High Net Worth, Retirement"
                  value={newClient.segment}
                  onChange={(e) => setNewClient({ ...newClient, segment: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Any additional notes about this client..."
                  value={newClient.notes}
                  onChange={(e) => setNewClient({ ...newClient, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsInviteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleInviteClient}
                disabled={createClientMutation.isPending}
              >
                {createClientMutation.isPending ? "Sending..." : "Send Invitation"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Client List</CardTitle>
          <CardDescription>
            All clients and their invitation status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading clients...</div>
          ) : !clients || clients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No clients yet. Invite your first client to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead>Portfolio Value</TableHead>
                  <TableHead>Premium YTD</TableHead>
                  <TableHead>Open Positions</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell>{client.email}</TableCell>
                    <TableCell>{getStatusBadge(client.invite_status || "PENDING")}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{client.risk_level || "N/A"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-muted-foreground" />
                        {client.portfolio_value?.toLocaleString() || "0"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-success">
                        <TrendingUp className="h-3 w-3" />
                        ${client.premium_ytd?.toLocaleString() || "0"}
                      </div>
                    </TableCell>
                    <TableCell>{client.open_csp_count || 0}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {client.invite_status === "ACCEPTED" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/advisor?client=${client.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        )}
                        {client.invite_status === "PENDING" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => resendInviteMutation.mutate(client)}
                            disabled={resendInviteMutation.isPending}
                          >
                            <Mail className="h-4 w-4 mr-1" />
                            Resend
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
