import { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, Clock, CheckCheck, Search, MoreVertical, Smile, ThumbsUp, Heart, Flame, PartyPopper, Eye, Paperclip, FileText, Image as ImageIcon, Download, X, Phone, Zap, MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMessaging, MessageChannel } from "@/hooks/useMessaging";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";
import { NotificationToggle } from "@/components/messaging/NotificationToggle";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NewMessageDialog } from "@/components/messaging/NewMessageDialog";
import { useUserRole } from "@/hooks/useUserRole";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

export function MessagingPanel() {
  const { threads, messages, selectedThreadId, setSelectedThreadId, sendMessage, filter, setFilter, addReaction, removeReaction } = useMessaging();
  const { activeRole } = useUserRole();
  const [messageInput, setMessageInput] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<MessageChannel>('app');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const selectedThread = threads.find(t => t.id === selectedThreadId);
  const canSendSms = selectedThread?.client_sms_opt_in && selectedThread?.client_phone_number;

  const handleSendMessage = async () => {
    if ((!messageInput.trim() && selectedFiles.length === 0) || !selectedThreadId) return;
    
    // Validate message length
    const trimmedMessage = messageInput.trim();
    if (trimmedMessage.length > 5000) {
      return;
    }

    // Validate SMS requirements
    if (selectedChannel === 'sms' && !canSendSms) {
      toast.error("Client has not opted in to SMS");
      return;
    }

    setSending(true);
    try {
      await sendMessage(selectedThreadId, trimmedMessage, selectedFiles, selectedChannel);
      setMessageInput("");
      setSelectedFiles([]);
      if (selectedChannel === 'sms') {
        toast.success("SMS sent successfully");
      }
    } catch (error) {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(prev => [...prev, ...Array.from(e.target.files || [])]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const downloadAttachment = async (filepath: string, filename: string) => {
    const { data, error } = await supabase.storage
      .from("message-attachments")
      .download(filepath);

    if (error) {
      console.error("Error downloading file:", error);
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <ImageIcon className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

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

  const reactionIcons = {
    thumbs_up: ThumbsUp,
    heart: Heart,
    fire: Flame,
    celebrate: PartyPopper,
    eyes: Eye,
  };

  const handleReaction = async (messageId: string, reaction: string) => {
    const message = messages.find(m => m.id === messageId);
    const userReaction = message?.reactions?.find(
      r => r.user_id === currentUserId && r.reaction === reaction
    );

    if (userReaction) {
      await removeReaction(messageId, reaction);
    } else {
      await addReaction(messageId, reaction);
    }
    setShowReactionPicker(null);
  };

  const getReactionCounts = (reactions: any[] = []) => {
    const counts = new Map<string, { count: number; hasReacted: boolean }>();
    
    reactions.forEach((r) => {
      const current = counts.get(r.reaction) || { count: 0, hasReacted: false };
      counts.set(r.reaction, {
        count: current.count + 1,
        hasReacted: current.hasReacted || r.user_id === currentUserId
      });
    });
    
    return counts;
  };

  const getChannelBadge = (channel?: string, direction?: string) => {
    if (channel === 'sms') {
      return (
        <Badge variant="outline" className="h-5 gap-1 text-[10px] px-1.5 border-blue-500/30 text-blue-500 bg-blue-500/10">
          <Phone className="h-3 w-3" />
          SMS
        </Badge>
      );
    }
    if (channel === 'system' || direction === 'system') {
      return (
        <Badge variant="secondary" className="h-5 gap-1 text-[10px] px-1.5 border-amber-500/30 text-amber-500 bg-amber-500/10">
          <Zap className="h-3 w-3" />
          Alert
        </Badge>
      );
    }
    return null;
  };

  const getLastMessageChannelIcon = (channel?: string) => {
    if (channel === 'sms') {
      return <Phone className="h-3 w-3 text-blue-500" />;
    }
    if (channel === 'system') {
      return <Zap className="h-3 w-3 text-amber-500" />;
    }
    return <MonitorSmartphone className="h-3 w-3 text-muted-foreground" />;
  };

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
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                          {getLastMessageChannelIcon(messages.find(m => m.thread_id === thread.id)?.channel)}
                          <span>Last message {formatDistanceToNow(new Date(thread.last_message_at), { addSuffix: true })}</span>
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
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-base">{selectedThread.client_name}</h3>
                      {canSendSms && (
                        <Badge variant="outline" className="text-[10px] px-1.5 h-4 gap-0.5 border-green-500/30 text-green-600 bg-green-500/10">
                          <Phone className="h-2.5 w-2.5" />
                          SMS
                        </Badge>
                      )}
                    </div>
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
                  const isSystemMessage = message.channel === 'system' || message.direction === 'system';
                  
                  const reactionCounts = getReactionCounts(message.reactions);
                  
                  // System messages have special rendering
                  if (isSystemMessage) {
                    return (
                      <div key={message.id} className="flex justify-center animate-in fade-in duration-300">
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 max-w-[80%]">
                          <div className="flex items-center gap-2 mb-1">
                            <Zap className="h-4 w-4 text-amber-500" />
                            <span className="text-xs font-medium text-amber-500">Portfolio Alert</span>
                          </div>
                          <p className="text-sm text-foreground">{message.content}</p>
                          <div className="flex items-center gap-1.5 mt-2 text-amber-500/60">
                            <Clock className="h-3 w-3" />
                            <span className="text-xs">{formatMessageTime(message.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  
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
                      <div className="flex flex-col gap-1 max-w-[70%]">
                        <div className="relative group">
                          <div
                            className={`rounded-2xl px-4 py-3 shadow-sm ${
                              isSentByMe
                                ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-br-md"
                                : "bg-muted/80 border border-border/50 rounded-bl-md"
                            }`}
                          >
                            {/* Channel Badge */}
                            {message.channel && message.channel !== 'app' && (
                              <div className="mb-2">
                                {getChannelBadge(message.channel, message.direction)}
                              </div>
                            )}
                            
                            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
                            
                            {/* Attachments */}
                            {message.attachments && message.attachments.length > 0 && (
                              <div className="mt-2 space-y-2">
                                {message.attachments.map((attachment, idx) => (
                                  <div
                                    key={idx}
                                    className={`flex items-center gap-2 p-2 rounded-lg ${
                                      isSentByMe ? "bg-primary-foreground/10" : "bg-background/50"
                                    } border ${isSentByMe ? "border-primary-foreground/20" : "border-border/50"}`}
                                  >
                                    {getFileIcon(attachment.type)}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium truncate">
                                        {attachment.filename}
                                      </p>
                                      <p className={`text-xs ${isSentByMe ? "text-primary-foreground/50" : "text-muted-foreground"}`}>
                                        {formatFileSize(attachment.size)}
                                      </p>
                                    </div>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => downloadAttachment(attachment.filepath, attachment.filename)}
                                      className={`h-7 w-7 ${isSentByMe ? "hover:bg-primary-foreground/10" : "hover:bg-muted"}`}
                                    >
                                      <Download className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}

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
                          
                          {/* Reaction Picker Button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`absolute ${isSentByMe ? '-left-8' : '-right-8'} top-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm border border-border/50 shadow-sm hover:bg-accent`}
                            onClick={() => setShowReactionPicker(showReactionPicker === message.id ? null : message.id)}
                          >
                            <Smile className="h-3.5 w-3.5" />
                          </Button>

                          {/* Reaction Picker */}
                          {showReactionPicker === message.id && (
                            <div className={`absolute ${isSentByMe ? 'right-0' : 'left-0'} top-full mt-1 bg-background/95 backdrop-blur-sm border border-border/50 rounded-xl shadow-lg p-2 flex gap-1 z-10 animate-in fade-in slide-in-from-top-2 duration-200`}>
                              {Object.entries(reactionIcons).map(([key, Icon]) => (
                                <Button
                                  key={key}
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 hover:bg-accent transition-colors"
                                  onClick={() => handleReaction(message.id, key)}
                                >
                                  <Icon className="h-4 w-4" />
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Reactions Display */}
                        {reactionCounts.size > 0 && (
                          <div className={`flex gap-1 mt-1 ${isSentByMe ? 'justify-end' : 'justify-start'}`}>
                            {Array.from(reactionCounts.entries()).map(([key, { count, hasReacted }]) => {
                              const Icon = reactionIcons[key as keyof typeof reactionIcons];
                              return (
                                <button
                                  key={key}
                                  onClick={() => handleReaction(message.id, key)}
                                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors ${
                                    hasReacted 
                                      ? 'bg-primary/10 text-primary border border-primary/20' 
                                      : 'bg-muted/50 text-muted-foreground border border-border/50 hover:bg-muted'
                                  }`}
                                >
                                  <Icon className="h-3 w-3" />
                                  <span>{count}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="border-t border-border/50 p-4 bg-background/80 backdrop-blur-sm">
              {/* Selected Files Preview */}
              {selectedFiles.length > 0 && (
                <div className="mb-3 space-y-2">
                  {selectedFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border/50"
                    >
                      {getFileIcon(file.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeFile(idx)}
                        className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Channel Selector */}
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Send via:</span>
                <TooltipProvider>
                  <div className="flex gap-1 bg-muted/30 rounded-lg p-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant={selectedChannel === 'app' ? 'default' : 'ghost'}
                          onClick={() => setSelectedChannel('app')}
                          className="h-7 px-3 text-xs gap-1.5"
                        >
                          <MonitorSmartphone className="h-3.5 w-3.5" />
                          App
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Send in-app message</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant={selectedChannel === 'sms' ? 'default' : 'ghost'}
                          onClick={() => canSendSms && setSelectedChannel('sms')}
                          disabled={!canSendSms}
                          className="h-7 px-3 text-xs gap-1.5"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          SMS
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {canSendSms 
                          ? 'Send SMS message' 
                          : activeRole === 'advisor' 
                            ? 'Client has not opted in to SMS' 
                            : 'Enable SMS in Settings to send text messages'}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
              </div>

              <div className="flex gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.txt"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending || selectedChannel === 'sms'}
                  className="h-10 w-10 rounded-xl shadow-sm hover:bg-accent"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Input
                  ref={inputRef}
                  placeholder={selectedChannel === 'sms' ? "Type your SMS message..." : "Type your message..."}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  maxLength={selectedChannel === 'sms' ? 160 : 5000}
                  disabled={sending}
                  className="bg-background border-border/50 focus-visible:ring-primary/50"
                />
                <Button 
                  onClick={handleSendMessage} 
                  size="icon" 
                  disabled={sending || (!messageInput.trim() && selectedFiles.length === 0)}
                  className={`h-10 w-10 rounded-xl shadow-sm transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 ${
                    selectedChannel === 'sms' ? 'bg-blue-500 hover:bg-blue-600' : ''
                  }`}
                >
                  {selectedChannel === 'sms' ? <Phone className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-right">
                {selectedChannel === 'sms' ? (
                  <>SMS: {messageInput.length}/160 characters</>
                ) : (
                  <>Press Enter to send • {messageInput.length}/5000</>
                )}
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
