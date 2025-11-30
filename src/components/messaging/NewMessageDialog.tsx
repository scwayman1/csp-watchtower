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
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMessaging } from "@/hooks/useMessaging";
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
};

export function NewMessageDialog() {
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { createThread, sendMessage } = useMessaging();
  const { toast } = useToast();

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
      .select("id, name, invite_status")
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
      const validated = messageSchema.parse({
        clientId: selectedClientId,
        subject: subject || undefined,
        message,
      });

      setLoading(true);

      // Create thread
      const thread = await createThread(validated.clientId, validated.subject);
      
      if (!thread) {
        throw new Error("Failed to create conversation");
      }

      // Send first message
      await sendMessage(thread.id, validated.message);

      toast({
        title: "Success",
        description: "Message sent successfully",
      });

      // Reset form and close
      setSelectedClientId("");
      setSubject("");
      setMessage("");
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
                      {client.name}
                      {client.invite_status === 'PENDING' && (
                        <span className="text-xs text-muted-foreground ml-2">(Pending)</span>
                      )}
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

          <div className="space-y-2">
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              placeholder="Type your message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              maxLength={5000}
            />
            <p className="text-xs text-muted-foreground text-right">
              {message.length}/5000
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !selectedClientId || !message.trim()}>
            {loading ? "Sending..." : "Send Message"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
