import { useState, useEffect } from "react";
import { MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMessaging } from "@/hooks/useMessaging";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { NotificationToggle } from "@/components/messaging/NotificationToggle";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NewMessageDialog } from "@/components/messaging/NewMessageDialog";
import { useUserRole } from "@/hooks/useUserRole";

export function MessagingPanel() {
  const { threads, messages, selectedThreadId, setSelectedThreadId, sendMessage, filter, setFilter } = useMessaging();
  const { activeRole } = useUserRole();
  const [messageInput, setMessageInput] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedThreadId) return;
    
    // Validate message length
    const trimmedMessage = messageInput.trim();
    if (trimmedMessage.length > 5000) {
      return;
    }

    setSending(true);
    try {
      await sendMessage(selectedThreadId, trimmedMessage);
      setMessageInput("");
    } finally {
      setSending(false);
    }
  };

  const selectedThread = threads.find(t => t.id === selectedThreadId);

  return (
    <div className="grid grid-cols-12 gap-4 h-[600px]">
      {/* Threads List */}
      <Card className="col-span-4 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Messages</h3>
          </div>
          <div className="flex items-center gap-2">
            {activeRole === 'advisor' && <NewMessageDialog />}
            <NotificationToggle />
          </div>
        </div>

        <Tabs value={filter} onValueChange={(value) => setFilter(value as 'all' | 'unread' | 'read')} className="mb-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread</TabsTrigger>
            <TabsTrigger value="read">Read</TabsTrigger>
          </TabsList>
        </Tabs>
        
        <ScrollArea className="h-[460px]">
          <div className="space-y-2">
            {threads.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No conversations yet
              </p>
            ) : (
              threads.map((thread) => (
                <button
                  key={thread.id}
                  onClick={() => setSelectedThreadId(thread.id)}
                  className={`w-full text-left p-3 rounded-lg hover:bg-muted/50 transition-colors relative ${
                    selectedThreadId === thread.id ? "bg-muted" : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{thread.client_name}</div>
                      {thread.subject && (
                        <div className="text-xs text-muted-foreground truncate">
                          {thread.subject}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(thread.last_message_at), { addSuffix: true })}
                      </div>
                    </div>
                    {(thread.unread_count || 0) > 0 && (
                      <Badge variant="destructive" className="ml-2 h-5 min-w-5 flex items-center justify-center px-1.5">
                        {thread.unread_count}
                      </Badge>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </Card>

      {/* Messages View */}
      <Card className="col-span-8 p-4 flex flex-col">
        {selectedThread ? (
          <>
            <div className="border-b pb-3 mb-4">
              <h3 className="font-semibold">{selectedThread.client_name}</h3>
              {selectedThread.subject && (
                <p className="text-sm text-muted-foreground">{selectedThread.subject}</p>
              )}
            </div>

            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4">
                {messages.map((message) => {
                  const isSentByMe = message.sender_id === currentUserId;
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isSentByMe ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          isSentByMe
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <p className={`text-xs mt-1 ${
                          isSentByMe ? "text-primary-foreground/70" : "text-muted-foreground"
                        }`}>
                          {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="flex gap-2 mt-4 pt-4 border-t">
              <Input
                placeholder="Type your message..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                maxLength={5000}
                disabled={sending}
              />
              <Button onClick={handleSendMessage} size="icon" disabled={sending || !messageInput.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
