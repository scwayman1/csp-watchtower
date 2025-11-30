import { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, Clock, CheckCheck, Search, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMessaging } from "@/hooks/useMessaging";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";
import { NotificationToggle } from "@/components/messaging/NotificationToggle";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NewMessageDialog } from "@/components/messaging/NewMessageDialog";
import { useUserRole } from "@/hooks/useUserRole";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function MessagingPanel() {
  const { threads, messages, selectedThreadId, setSelectedThreadId, sendMessage, filter, setFilter } = useMessaging();
  const { activeRole } = useUserRole();
  const [messageInput, setMessageInput] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (selectedThreadId) {
      inputRef.current?.focus();
    }
  }, [selectedThreadId]);

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

  const formatMessageTime = (date: string) => {
    const messageDate = new Date(date);
    if (isToday(messageDate)) {
      return format(messageDate, "h:mm a");
    } else if (isYesterday(messageDate)) {
      return "Yesterday";
    } else {
      return format(messageDate, "MMM d");
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const filteredThreads = threads.filter((thread) =>
    thread.client_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="grid grid-cols-12 gap-6 h-[calc(100vh-12rem)]">
      {/* Threads List */}
      <Card className="col-span-4 p-0 flex flex-col overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="p-4 border-b border-border/50 bg-background/80 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">Messages</h3>
            </div>
            <div className="flex items-center gap-2">
              {activeRole === 'advisor' && <NewMessageDialog />}
              <NotificationToggle />
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background/50"
            />
          </div>
        </div>

        <Tabs value={filter} onValueChange={(value) => setFilter(value as 'all' | 'unread' | 'read')} className="px-4 pt-3">
          <TabsList className="grid w-full grid-cols-3 bg-muted/30">
            <TabsTrigger value="all" className="data-[state=active]:bg-background">All</TabsTrigger>
            <TabsTrigger value="unread" className="data-[state=active]:bg-background">Unread</TabsTrigger>
            <TabsTrigger value="read" className="data-[state=active]:bg-background">Read</TabsTrigger>
          </TabsList>
        </Tabs>
        
        <ScrollArea className="flex-1 px-2">
          <div className="space-y-1 py-3">
            {filteredThreads.length === 0 ? (
              <div className="text-center py-12">
                <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                  <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? "No matching conversations" : "No conversations yet"}
                </p>
              </div>
            ) : (
              filteredThreads.map((thread) => (
                <button
                  key={thread.id}
                  onClick={() => setSelectedThreadId(thread.id)}
                  className={`w-full text-left p-3 rounded-xl transition-all duration-200 group relative overflow-hidden ${
                    selectedThreadId === thread.id
                      ? "bg-primary/10 shadow-sm border border-primary/20"
                      : "hover:bg-muted/50 border border-transparent"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary font-semibold">
                        {thread.client_name ? getInitials(thread.client_name) : "??"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-sm truncate">{thread.client_name}</span>
                        <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                          {formatMessageTime(thread.last_message_at)}
                        </span>
                      </div>
                      {thread.subject && (
                        <div className="text-xs text-muted-foreground/80 truncate font-medium mb-0.5">
                          {thread.subject}
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground truncate">
                          Last message {formatDistanceToNow(new Date(thread.last_message_at), { addSuffix: true })}
                        </div>
                        {(thread.unread_count || 0) > 0 && (
                          <Badge variant="default" className="ml-2 h-5 min-w-5 flex items-center justify-center px-1.5 text-xs font-bold shadow-sm">
                            {thread.unread_count}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </Card>

      {/* Messages View */}
      <Card className="col-span-8 p-0 flex flex-col overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm">
        {selectedThread ? (
          <>
            <div className="border-b border-border/50 p-4 bg-background/80 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-11 w-11 border-2 border-background shadow-md">
                    <AvatarFallback className="bg-gradient-to-br from-primary/30 to-primary/10 text-primary font-bold text-base">
                      {selectedThread.client_name ? getInitials(selectedThread.client_name) : "??"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-base">{selectedThread.client_name}</h3>
                    {selectedThread.subject && (
                      <p className="text-xs text-muted-foreground">{selectedThread.subject}</p>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 px-4 py-6">
              <div className="space-y-6">
                {messages.map((message, index) => {
                  const isSentByMe = message.sender_id === currentUserId;
                  const showAvatar = index === 0 || messages[index - 1].sender_id !== message.sender_id;
                  
                  return (
                    <div
                      key={message.id}
                      className={`flex gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300 ${
                        isSentByMe ? "justify-end" : "justify-start"
                      }`}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      {!isSentByMe && (
                        <Avatar className={`h-8 w-8 border border-border shadow-sm ${showAvatar ? 'opacity-100' : 'opacity-0'}`}>
                          <AvatarFallback className="bg-gradient-to-br from-muted to-muted/50 text-muted-foreground text-xs font-semibold">
                            {selectedThread.client_name ? getInitials(selectedThread.client_name) : "??"}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-3 shadow-sm ${
                          isSentByMe
                            ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-br-md"
                            : "bg-muted/80 border border-border/50 rounded-bl-md"
                        }`}
                      >
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
                        <div className={`flex items-center gap-1.5 mt-2 ${
                          isSentByMe ? "text-primary-foreground/60" : "text-muted-foreground/70"
                        }`}>
                          <Clock className="h-3 w-3" />
                          <span className="text-xs">
                            {formatMessageTime(message.created_at)}
                          </span>
                          {isSentByMe && message.read_at && (
                            <CheckCheck className="h-3.5 w-3.5 ml-1" />
                          )}
                        </div>
                      </div>
                      {isSentByMe && (
                        <Avatar className={`h-8 w-8 border border-border shadow-sm ${showAvatar ? 'opacity-100' : 'opacity-0'}`}>
                          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary text-xs font-bold">
                            ME
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="border-t border-border/50 p-4 bg-background/80 backdrop-blur-sm">
              <div className="flex gap-3">
                <Input
                  ref={inputRef}
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
                  className="bg-background border-border/50 focus-visible:ring-primary/50"
                />
                <Button 
                  onClick={handleSendMessage} 
                  size="icon" 
                  disabled={sending || !messageInput.trim()}
                  className="h-10 w-10 rounded-xl shadow-sm transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-right">
                Press Enter to send • {messageInput.length}/5000
              </p>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mx-auto mb-4 shadow-inner">
                <MessageSquare className="h-10 w-10 text-primary/50" />
              </div>
              <p className="font-medium text-foreground mb-1">Select a conversation</p>
              <p className="text-sm">Choose a conversation from the list to start messaging</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
