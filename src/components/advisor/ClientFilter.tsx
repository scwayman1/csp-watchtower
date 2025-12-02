import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface ClientFilterProps {
  selectedClientId: string | null;
  onClientSelect: (clientId: string | null) => void;
}

export function ClientFilter({ selectedClientId, onClientSelect }: ClientFilterProps) {
  const { data: clients, isLoading } = useQuery({
    queryKey: ["advisor-clients"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("advisor_id", user.id)
        .eq("invite_status", "ACCEPTED")
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  if (isLoading || !clients || clients.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={selectedClientId || "all"}
        onValueChange={(value) => onClientSelect(value === "all" ? null : value)}
      >
        <SelectTrigger className="w-[250px] bg-card/50 border-border/50">
          <SelectValue placeholder="All Clients" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Clients</SelectItem>
          {clients.map((client) => (
            <SelectItem key={client.id} value={client.id}>
              {client.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedClientId && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onClientSelect(null)}
          className="h-9 w-9"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
