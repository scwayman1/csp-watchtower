import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, StickyNote, TrendingUp, Target, CheckCircle2 } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { AICoachingInsights } from "./AICoachingInsights";

interface ClientCoachingTabProps {
  client: Tables<"clients">;
}

export function ClientCoachingTab({ client }: ClientCoachingTabProps) {
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState("");
  const [notes, setNotes] = useState(client.notes || "");
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // Get thread with this client
  const { data: thread } = useQuery({
    queryKey: ["client-thread", client.id],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("threads")
        .select("*")
        .eq("advisor_id", user.id)
        .eq("client_id", client.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Get messages for thread
  const { data: messages } = useQuery({
    queryKey: ["client-messages", thread?.id],
    queryFn: async () => {
      if (!thread) return [];

      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("thread_id", thread.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!thread,
  });

  // Get full learning data for AI analysis
  const { data: learningPositions } = useQuery({
    queryKey: ["client-learning-positions-full", client.user_id],
    queryFn: async () => {
      if (!client.user_id) return [];
      const { data, error } = await supabase
        .from("learning_positions")
        .select("*")
        .eq("user_id", client.user_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!client.user_id,
  });

  const { data: learningAssigned } = useQuery({
    queryKey: ["client-learning-assigned-full", client.user_id],
    queryFn: async () => {
      if (!client.user_id) return [];
      const { data, error } = await supabase
        .from("learning_assigned_positions")
        .select("*")
        .eq("user_id", client.user_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!client.user_id,
  });

  const { data: simulatorSettings } = useQuery({
    queryKey: ["client-simulator-settings-coaching", client.user_id],
    queryFn: async () => {
      if (!client.user_id) return null;
      const { data, error } = await supabase
        .from("simulator_settings")
        .select("*")
        .eq("user_id", client.user_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!client.user_id,
  });

  // Calculate days active
  const daysActive = learningPositions?.length
    ? differenceInDays(
        new Date(),
        learningPositions.reduce((earliest, p) => {
          const pDate = new Date(p.created_at);
          return pDate < earliest ? pDate : earliest;
        }, new Date())
      )
    : 0;

  // Learning progress metrics for coaching insights
  const learningStats = {
    totalTrades: learningPositions?.length || 0,
    closedTrades: learningPositions?.filter(p => !p.is_active).length || 0,
    assignmentRate: learningPositions?.length 
      ? ((learningAssigned?.length || 0) / learningPositions.length * 100) 
      : 0,
    totalPremium: learningPositions?.reduce((sum, p) => sum + (p.premium_per_contract * p.contracts * 100), 0) || 0,
    hasActivity: (learningPositions?.length || 0) > 0,
  };

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let threadId = thread?.id;

      // Create thread if it doesn't exist
      if (!threadId) {
        const { data: newThread, error: threadError } = await supabase
          .from("threads")
          .insert({
            advisor_id: user.id,
            client_id: client.id,
            subject: "Coaching Discussion",
          })
          .select()
          .single();

        if (threadError) throw threadError;
        threadId = newThread.id;
      }

      // Send message
      const { error } = await supabase
        .from("messages")
        .insert({
          thread_id: threadId,
          sender_id: user.id,
          recipient_id: client.user_id || client.id,
          content,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["client-thread", client.id] });
      queryClient.invalidateQueries({ queryKey: ["client-messages"] });
      toast.success("Message sent");
    },
    onError: () => {
      toast.error("Failed to send message");
    },
  });

  // Save notes
  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    try {
      const { error } = await supabase
        .from("clients")
        .update({ notes })
        .eq("id", client.id);

      if (error) throw error;
      toast.success("Notes saved");
    } catch {
      toast.error("Failed to save notes");
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    sendMessage.mutate(newMessage);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Messages */}
      <div className="lg:col-span-2 space-y-4">
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Coaching Messages
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScrollArea className="h-[400px] pr-4">
              {messages && messages.length > 0 ? (
                <div className="space-y-4">
                  {messages.map((message) => {
                    const isAdvisor = message.sender_id !== client.user_id;
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isAdvisor ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-3 ${
                            isAdvisor
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          <p className="text-sm">{message.content}</p>
                          <p className="text-xs opacity-70 mt-1">
                            {format(new Date(message.created_at), "MMM d, h:mm a")}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p>No messages yet. Start the coaching conversation!</p>
                </div>
              )}
            </ScrollArea>

            <div className="flex gap-2">
              <Textarea
                placeholder="Write a coaching message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="min-h-[80px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || sendMessage.isPending}
                className="self-end"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        {/* AI Coaching Insights */}
        <AICoachingInsights
          client={client}
          positions={learningPositions}
          assignedPositions={learningAssigned}
          startingCapital={simulatorSettings?.starting_capital || 100000}
          daysActive={daysActive}
        />

        {/* Quick Learning Stats */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Learning Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {learningStats.hasActivity ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Trades</span>
                  <Badge variant="secondary">{learningStats.totalTrades}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Closed Trades</span>
                  <Badge variant="secondary">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {learningStats.closedTrades}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Assignment Rate</span>
                  <Badge variant={learningStats.assignmentRate > 30 ? "destructive" : "secondary"}>
                    {learningStats.assignmentRate.toFixed(1)}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Premium</span>
                  <span className="text-sm font-medium text-green-500">
                    ${learningStats.totalPremium.toLocaleString()}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No learning activity yet.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Coaching Notes */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <StickyNote className="h-4 w-4" />
              Private Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="Add private notes about this client..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[120px]"
            />
            <Button
              onClick={handleSaveNotes}
              disabled={isSavingNotes || notes === client.notes}
              size="sm"
              className="w-full"
            >
              {isSavingNotes ? "Saving..." : "Save Notes"}
            </Button>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" size="sm" className="w-full justify-start">
              View Live Portfolio
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start">
              Schedule Call
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start">
              Create Trade Recommendation
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
