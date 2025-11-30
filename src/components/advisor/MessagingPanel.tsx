import { useState, useEffect } from "react";
import { MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMessaging } from "@/hooks/useMessaging";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

export function MessagingPanel() {
  const { threads, messages, selectedThreadId, setSelectedThreadId, sendMessage } = useMessaging();
  const [messageInput, setMessageInput] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedThreadId) return;
    
    await sendMessage(selectedThreadId, messageInput);
    setMessageInput("");
  };

  const selectedThread = threads.find(t => t.id === selectedThreadId);

  return (
    <div className="grid grid-cols-12 gap-4 h-[600px]">
      {/* Threads List */}
      <Card className="col-span-4 p-4">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Messages</h3>
        </div>
        
        <ScrollArea className="h-[520px]">
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
                  className={`w-full text-left p-3 rounded-lg hover:bg-muted/50 transition-colors ${
                    selectedThreadId === thread.id ? "bg-muted" : ""
                  }`}
                >
                  <div className="font-medium text-sm">{thread.client_name}</div>
                  {thread.subject && (
                    <div className="text-xs text-muted-foreground truncate">
                      {thread.subject}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(thread.last_message_at), { addSuffix: true })}
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
              />
              <Button onClick={handleSendMessage} size="icon">
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
