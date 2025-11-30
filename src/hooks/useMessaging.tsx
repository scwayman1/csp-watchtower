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
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  useEffect(() => {
    fetchThreads();
    subscribeToThreads();
  }, []);

  useEffect(() => {
    if (selectedThreadId) {
      fetchMessages(selectedThreadId);
      markThreadAsRead(selectedThreadId);
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
      
      // Fetch unread counts for each thread
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const threadsWithNamesAndCounts = await Promise.all(
        data.map(async (thread) => {
          const { count } = await supabase
            .from("messages")
            .select("*", { count: 'exact', head: true })
            .eq("thread_id", thread.id)
            .eq("recipient_id", user.id)
            .is("read_at", null);

          return {
            ...thread,
            client_name: clientMap.get(thread.client_id) || "Unknown Client",
            unread_count: count || 0
          };
        })
      );

      setThreads(threadsWithNamesAndCounts);
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

    // Trigger push notification to the client user (if linked)
    try {
      let recipientUserId: string | null = null;

      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select("user_id")
        .eq("id", thread.client_id)
        .maybeSingle();

      if (clientError) {
        console.error("Error fetching client for push notification:", clientError);
      }

      if (client?.user_id) {
        recipientUserId = client.user_id;
      }

      if (!recipientUserId) {
        console.log("No linked client user_id for thread; skipping push notification");
        return;
      }

      await supabase.functions.invoke('send-push-notification', {
        body: {
          userId: recipientUserId,
          title: 'New Message',
          body: 'New message from your advisor',
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
          fetchThreads(); // Refresh unread counts
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const markThreadAsRead = async (threadId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("thread_id", threadId)
      .eq("recipient_id", user.id)
      .is("read_at", null);

    // Refresh threads to update unread counts
    fetchThreads();
  };

  const filteredThreads = threads.filter(thread => {
    if (filter === 'unread') return (thread.unread_count || 0) > 0;
    if (filter === 'read') return (thread.unread_count || 0) === 0;
    return true;
  });

  const totalUnreadCount = threads.reduce((sum, thread) => sum + (thread.unread_count || 0), 0);

  return {
    threads: filteredThreads,
    messages,
    selectedThreadId,
    setSelectedThreadId,
    loading,
    sendMessage,
    createThread,
    filter,
    setFilter,
    totalUnreadCount
  };
}
