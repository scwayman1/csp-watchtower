import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, User, GraduationCap, MessageSquare } from "lucide-react";
import { ClientProfileTab } from "@/components/advisor/client-detail/ClientProfileTab";
import { ClientLearningTab } from "@/components/advisor/client-detail/ClientLearningTab";
import { ClientCoachingTab } from "@/components/advisor/client-detail/ClientCoachingTab";

export default function ClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("profile");

  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ["client-detail", clientId],
    queryFn: async () => {
      if (!clientId) throw new Error("No client ID");
      
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  const { data: clientProfile } = useQuery({
    queryKey: ["client-profile", client?.user_id],
    queryFn: async () => {
      if (!client?.user_id) return null;
      
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", client.user_id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!client?.user_id,
  });

  if (clientLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-64"></div>
          <div className="h-96 bg-muted rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Client not found</p>
          <Button variant="ghost" onClick={() => navigate("/advisor/clients")} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Clients
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/advisor/clients")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{client.name}</h1>
          <p className="text-sm text-muted-foreground">{client.email}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-card/50 border border-border/50">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="learning" className="gap-2">
            <GraduationCap className="h-4 w-4" />
            Learning Center
          </TabsTrigger>
          <TabsTrigger value="coaching" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Coaching
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ClientProfileTab client={client} profile={clientProfile} />
        </TabsContent>

        <TabsContent value="learning">
          <ClientLearningTab client={client} />
        </TabsContent>

        <TabsContent value="coaching">
          <ClientCoachingTab client={client} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
