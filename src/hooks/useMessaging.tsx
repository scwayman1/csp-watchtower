import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Thread = Tables<"threads"> & {
  unread_count?: number;
  client_name?: string;
  client_sms_opt_in?: boolean;
  client_phone_number?: string;
};

export interface Attachment {
  id: string;
  filename: string;
  filepath: string;
  size: number;
  type: string;
}

export type MessageChannel = 'app' | 'sms' | 'system';
export type MessageDirection = 'outbound' | 'inbound' | 'system';

type Message = Omit<Tables<"messages">, "attachments"> & {
  reactions?: MessageReaction[];
  attachments?: Attachment[];
  channel?: MessageChannel;
  direction?: MessageDirection;
  provider_message_id?: string;
  meta?: Record<string, any>;
};

type MessageReaction = Tables<"message_reactions">;

export function useMessaging() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  useEffect(() => {
    fetchThreads();
    const unsubscribe = subscribeToThreads();

    return () => {
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (selectedThreadId) {
      fetchMessages(selectedThreadId);
      // Delay marking as read slightly to ensure messages are loaded first
      const timer = setTimeout(() => {
        markThreadAsRead(selectedThreadId);
      }, 300);
      subscribeToMessages(selectedThreadId);
      return () => clearTimeout(timer);
    }
  }, [selectedThreadId]);

  const fetchThreads = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check if user is advisor or client
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdvisor = roles?.some(r => r.role === 'advisor');

    let threadsQuery;
    if (isAdvisor) {
      // Advisor: fetch threads where they are the advisor
      threadsQuery = supabase
        .from("threads")
        .select("*")
        .eq("advisor_id", user.id)
        .order("last_message_at", { ascending: false });
    } else {
      // Client: fetch threads where they are linked as client
      const { data: clientData } = await supabase
        .from("clients")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!clientData) {
        setThreads([]);
        setLoading(false);
        return;
      }

      threadsQuery = supabase
        .from("threads")
        .select("*")
        .eq("client_id", clientData.id)
        .order("last_message_at", { ascending: false });
    }

    const { data, error } = await threadsQuery;

    if (error) {
      console.error("Error fetching threads:", error);
      return;
    }

    // Fetch client names or advisor names depending on role
    if (data && data.length > 0) {
      if (isAdvisor) {
        const clientIds = [...new Set(data.map(t => t.client_id))] as string[];
        const { data: clients } = await supabase
          .from("clients")
          .select("id, name, sms_opt_in, phone_number")
          .in("id", clientIds);

        const clientMap = new Map(clients?.map(c => [c.id, c]) || []);
        
        // Fetch unread counts for each thread
        const threadsWithNamesAndCounts = await Promise.all(
          data.map(async (thread) => {
            const { count } = await supabase
              .from("messages")
              .select("*", { count: 'exact', head: true })
              .eq("thread_id", thread.id)
              .eq("recipient_id", user.id)
              .is("read_at", null);

            const client = clientMap.get(thread.client_id);
            return {
              ...thread,
              client_name: client?.name || "Unknown Client",
              client_sms_opt_in: client?.sms_opt_in || false,
              client_phone_number: client?.phone_number || null,
              unread_count: count || 0
            };
          })
        );

        setThreads(threadsWithNamesAndCounts);
      } else {
        // For clients, show "Advisor" as the name and load their own SMS settings
        // First, get the current user's client record to get their SMS settings
        const { data: myClientRecord } = await supabase
          .from("clients")
          .select("phone_number, sms_opt_in")
          .eq("user_id", user.id)
          .maybeSingle();
        
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
              client_name: "Your Advisor",
              // Use the investor's own SMS settings
              client_sms_opt_in: myClientRecord?.sms_opt_in || false,
              client_phone_number: myClientRecord?.phone_number || null,
              unread_count: count || 0
            };
          })
        );

        setThreads(threadsWithNamesAndCounts);
      }
    } else {
      setThreads([]);
    }
    setLoading(false);
  };

  const fetchMessages = async (threadId: string) => {
    const { data: messagesData, error } = await supabase
      .from("messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching messages:", error);
      return;
    }

    if (!messagesData) {
      setMessages([]);
      return;
    }

    // Fetch reactions for all messages
    const messageIds = messagesData.map(m => m.id);
    const { data: reactionsData } = await supabase
      .from("message_reactions")
      .select("*")
      .in("message_id", messageIds);

    // Attach reactions to messages and parse attachments
    const messagesWithReactions: Message[] = messagesData.map(message => ({
      ...message,
      reactions: reactionsData?.filter(r => r.message_id === message.id) || [],
      attachments: (message.attachments as unknown as Attachment[]) || [],
      channel: (message as any).channel as MessageChannel || 'app',
      direction: (message as any).direction as MessageDirection || 'outbound',
      provider_message_id: (message as any).provider_message_id,
      meta: (message as any).meta
    }));

    setMessages(messagesWithReactions);
  };

  const sendMessage = async (
    threadId: string, 
    content: string, 
    files?: File[], 
    channel: MessageChannel = 'app'
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const thread = threads.find(t => t.id === threadId);
    if (!thread) return;

    try {
      let attachments: Attachment[] = [];

      // Upload files if provided
      if (files && files.length > 0) {
        const uploadPromises = files.map(async (file) => {
          const fileExt = file.name.split(".").pop();
          const fileName = `${threadId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from("message-attachments")
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          return {
            id: fileName,
            filename: file.name,
            filepath: fileName,
            size: file.size,
            type: file.type,
          };
        });

        attachments = await Promise.all(uploadPromises);
      }

      // Determine recipient based on who is sending
      let recipientUserId: string;
      
      if (user.id === thread.advisor_id) {
        // Advisor sending to client - get client's user_id
        const { data: client } = await supabase
          .from("clients")
          .select("user_id, phone_number, sms_opt_in")
          .eq("id", thread.client_id)
          .maybeSingle();
        
        if (!client?.user_id) {
          console.error("Client user_id not found");
          return;
        }
        recipientUserId = client.user_id;

        // If SMS channel, send via Twilio
        if (channel === 'sms' && client.sms_opt_in && client.phone_number) {
          const { data: smsResult, error: smsError } = await supabase.functions.invoke('send-sms', {
            body: {
              to: client.phone_number,
              message: content
            }
          });

          if (smsError) {
            console.error("Error sending SMS:", smsError);
            throw smsError;
          }

          // Insert message with SMS details
          const { error: insertError } = await supabase
            .from("messages")
            .insert({
              thread_id: threadId,
              sender_id: user.id,
              recipient_id: recipientUserId,
              content,
              attachments: attachments as any,
              channel: 'sms',
              direction: 'outbound',
              provider_message_id: smsResult?.messageSid,
              meta: { provider: 'twilio', status: smsResult?.status }
            });

          if (insertError) throw insertError;

          // Update thread's last_message_at
          await supabase
            .from("threads")
            .update({ last_message_at: new Date().toISOString() })
            .eq("id", threadId);

          return;
        }
      } else {
        // Client sending to advisor
        recipientUserId = thread.advisor_id;
      }

      // Standard app message
      const { error } = await supabase
        .from("messages")
        .insert({
          thread_id: threadId,
          sender_id: user.id,
          recipient_id: recipientUserId,
          content,
          attachments: attachments as any,
          channel: channel,
          direction: 'outbound'
        });

      if (error) throw error;

      // Update thread's last_message_at
      await supabase
        .from("threads")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", threadId);

      // Trigger push notification for app messages
      if (channel === 'app') {
        await supabase.functions.invoke('send-push-notification', {
          body: {
            userId: recipientUserId,
            title: 'New Message',
            body: content || 'Sent an attachment',
            data: { threadId, messageContent: content }
          }
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
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
        subject,
        primary_client_id: clientId
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
      .channel("threads-and-messages")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "threads",
        },
        () => {
          fetchThreads();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
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
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_reactions"
        },
        () => {
          fetchMessages(threadId); // Refresh reactions
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

    // First check if there are actually any unread messages for this user in this thread
    const { count } = await supabase
      .from("messages")
      .select("*", { count: 'exact', head: true })
      .eq("thread_id", threadId)
      .eq("recipient_id", user.id)
      .is("read_at", null);

    // Only update if there are unread messages where user is the recipient
    if (count && count > 0) {
      const { error } = await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("thread_id", threadId)
        .eq("recipient_id", user.id)
        .is("read_at", null);

      if (!error) {
        // Refresh threads to update unread counts
        fetchThreads();
      }
    }
  };

  const filteredThreads = threads.filter(thread => {
    if (filter === 'unread') return (thread.unread_count || 0) > 0;
    if (filter === 'read') return (thread.unread_count || 0) === 0;
    return true;
  });

  const totalUnreadCount = threads.reduce((sum, thread) => sum + (thread.unread_count || 0), 0);

  const addReaction = async (messageId: string, reaction: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("message_reactions")
      .insert({
        message_id: messageId,
        user_id: user.id,
        reaction
      });

    if (error) {
      console.error("Error adding reaction:", error);
    }
  };

  const removeReaction = async (messageId: string, reaction: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("message_reactions")
      .delete()
      .eq("message_id", messageId)
      .eq("user_id", user.id)
      .eq("reaction", reaction);

    if (error) {
      console.error("Error removing reaction:", error);
    }
  };

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
    totalUnreadCount,
    addReaction,
    removeReaction
  };
}
