import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Phone, MonitorSmartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMessaging, MessageChannel } from "@/hooks/useMessaging";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const messageSchema = z.object({
  clientId: z.string().uuid({ message: "Please select a client" }),
  subject: z.string().max(200, { message: "Subject must be less than 200 characters" }).optional(),
  message: z.string().trim().min(1, { message: "Message cannot be empty" }).max(5000, { message: "Message must be less than 5000 characters" }),
});

type Client = {
  id: string;
  name: string;
  invite_status: string | null;
  sms_opt_in: boolean | null;
  phone_number: string | null;
};

export function NewMessageDialog() {
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<MessageChannel>('app');
  const { createThread, sendMessage } = useMessaging();
  const { toast } = useToast();

  // Get selected client's SMS settings
  const selectedClient = clients.find(c => c.id === selectedClientId);
  const canSendSms = selectedClient?.sms_opt_in && selectedClient?.phone_number;

  // Reset channel to 'app' if client changes and SMS not available
  useEffect(() => {
    if (!canSendSms && selectedChannel === 'sms') {
      setSelectedChannel('app');
    }
  }, [selectedClientId, canSendSms, selectedChannel]);

  useEffect(() => {
    if (open) {
      fetchClients();
    }
  }, [open]);

  const fetchClients = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("clients")
      .select("id, name, invite_status, sms_opt_in, phone_number")
      .eq("advisor_id", user.id)
      .order("name");

    if (error) {
      console.error("Error fetching clients:", error);
      toast({
        title: "Error",
        description: "Failed to load clients",
        variant: "destructive",
      });
      return;
    }

    setClients(data || []);
  };

  const handleSubmit = async () => {
    try {
      // Validate inputs
      const maxLength = selectedChannel === 'sms' ? 160 : 5000;
      const validated = messageSchema.parse({
        clientId: selectedClientId,
        subject: subject || undefined,
        message,
      });

      if (selectedChannel === 'sms' && message.length > 160) {
        toast({
          title: "Message too long",
          description: "SMS messages must be 160 characters or less",
          variant: "destructive",
        });
        return;
      }

      setLoading(true);

      // Create thread
      const thread = await createThread(validated.clientId, validated.subject);
      
      if (!thread) {
        throw new Error("Failed to create conversation");
      }

      // Send first message with selected channel
      await sendMessage(thread.id, validated.message, [], selectedChannel);

      if (selectedChannel === 'sms') {
        toast({
          title: "SMS Sent",
          description: "Message sent via SMS successfully",
        });
      } else {
        toast({
          title: "Success",
          description: "Message sent successfully",
        });
      }

      // Reset form and close
      setSelectedClientId("");
      setSubject("");
      setMessage("");
      setSelectedChannel('app');
      setOpen(false);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        toast({
          title: "Validation Error",
          description: firstError.message,
          variant: "destructive",
        });
      } else {
        console.error("Error sending message:", error);
        toast({
          title: "Error",
          description: "Failed to send message",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const maxLength = selectedChannel === 'sms' ? 160 : 5000;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          New Message
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Conversation</DialogTitle>
          <DialogDescription>
            Start a new conversation with a client
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="client">Client *</Label>
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger id="client">
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clients.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    No clients available
                  </div>
                ) : (
                  clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      <div className="flex items-center gap-2">
                        {client.name}
                        {client.invite_status === 'PENDING' && (
                          <span className="text-xs text-muted-foreground">(Pending)</span>
                        )}
                        {client.sms_opt_in && client.phone_number && (
                          <Phone className="h-3 w-3 text-primary" />
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject (optional)</Label>
            <Input
              id="subject"
              placeholder="Enter subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
            />
          </div>

          {/* Channel Selector */}
          {selectedClientId && (
            <div className="space-y-2">
              <Label>Send via</Label>
              <TooltipProvider>
                <div className="flex gap-1 bg-muted/30 rounded-lg p-1 w-fit">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        variant={selectedChannel === 'app' ? 'default' : 'ghost'}
                        onClick={() => setSelectedChannel('app')}
                        className="h-8 px-4 text-sm gap-2"
                      >
                        <MonitorSmartphone className="h-4 w-4" />
                        App
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Send in-app message</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        variant={selectedChannel === 'sms' ? 'default' : 'ghost'}
                        onClick={() => canSendSms && setSelectedChannel('sms')}
                        disabled={!canSendSms}
                        className="h-8 px-4 text-sm gap-2"
                      >
                        <Phone className="h-4 w-4" />
                        SMS
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {canSendSms ? 'Send SMS message' : 'Client has not opted in to SMS'}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              placeholder={selectedChannel === 'sms' ? "Type your SMS message..." : "Type your message..."}
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, maxLength))}
              rows={selectedChannel === 'sms' ? 3 : 6}
              maxLength={maxLength}
            />
            <p className={`text-xs text-right ${message.length > maxLength * 0.9 ? 'text-warning' : 'text-muted-foreground'}`}>
              {message.length}/{maxLength}
              {selectedChannel === 'sms' && ' characters'}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || !selectedClientId || !message.trim()}
            className="gap-2"
          >
            {selectedChannel === 'sms' && <Phone className="h-4 w-4" />}
            {loading ? "Sending..." : selectedChannel === 'sms' ? "Send SMS" : "Send Message"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
