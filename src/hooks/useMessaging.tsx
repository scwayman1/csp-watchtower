import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Thread = Tables<"threads"> & {
  unread_count?: number;
  client_name?: string;
};

type Message = Tables<"messages">;

export function useMessaging() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchThreads();
    subscribeToThreads();
  }, []);

  useEffect(() => {
    if (selectedThreadId) {
      fetchMessages(selectedThreadId);
      subscribeToMessages(selectedThreadId);
    }
  }, [selectedThreadId]);

  const fetchThreads = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("threads")
      .select("*")
      .eq("advisor_id", user.id)
      .order("last_message_at", { ascending: false });

    if (error) {
      console.error("Error fetching threads:", error);
      return;
    }

    // Fetch client names separately
    if (data && data.length > 0) {
      const clientIds = [...new Set(data.map(t => t.client_id))];
      const { data: clients } = await supabase
        .from("clients")
        .select("id, name")
        .in("id", clientIds);

      const clientMap = new Map(clients?.map(c => [c.id, c.name]) || []);
      
      const threadsWithNames = data.map(thread => ({
        ...thread,
        client_name: clientMap.get(thread.client_id) || "Unknown Client"
      }));

      setThreads(threadsWithNames);
    } else {
      setThreads([]);
    }
    setLoading(false);
  };

  const fetchMessages = async (threadId: string) => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching messages:", error);
      return;
    }

    setMessages(data || []);
  };

  const sendMessage = async (threadId: string, content: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const thread = threads.find(t => t.id === threadId);
    if (!thread) return;

    const { error } = await supabase
      .from("messages")
      .insert({
        thread_id: threadId,
        sender_id: user.id,
        recipient_id: thread.client_id,
        content
      });

    if (error) {
      console.error("Error sending message:", error);
      return;
    }

    // Update thread's last_message_at
    await supabase
      .from("threads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", threadId);

    // Trigger push notification
    try {
      await supabase.functions.invoke('send-push-notification', {
        body: {
          userId: thread.client_id,
          title: 'New Message',
          body: `New message from your advisor`,
          data: { threadId, messageContent: content }
        }
      });
    } catch (error) {
      console.error("Error sending push notification:", error);
    }
  };

  const createThread = async (clientId: string, subject?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("threads")
      .insert({
        advisor_id: user.id,
        client_id: clientId,
        subject
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating thread:", error);
      return;
    }

    fetchThreads();
    return data;
  };

  const subscribeToThreads = () => {
    const channel = supabase
      .channel("threads-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "threads"
        },
        () => {
          fetchThreads();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const subscribeToMessages = (threadId: string) => {
    const channel = supabase
      .channel(`messages-${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `thread_id=eq.${threadId}`
        },
        () => {
          fetchMessages(threadId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  return {
    threads,
    messages,
    selectedThreadId,
    setSelectedThreadId,
    loading,
    sendMessage,
    createThread
  };
}
