import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Client {
  id: string;
  name: string;
  available_cash: number;
  risk_level: string | null;
  user_id: string | null;
}

interface ModelTrade {
  id: string;
  underlying: string;
  strike: number;
  expiration: string;
  target_premium: number;
  strategy: string;
}

interface AllocationMatrixProps {
  cycleId: string;
  modelTrades: ModelTrade[];
  onClose: () => void;
  onComplete: () => void;
}

interface AllocationInput {
  modelTradeId: string;
  clientId: string;
  contracts: number;
}

export function AllocationMatrix({
  cycleId,
  modelTrades,
  onClose,
  onComplete,
}: AllocationMatrixProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [allocations, setAllocations] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchClients();
    fetchExistingAllocations();
  }, []);

  const fetchClients = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("advisor_id", user.id)
        .order("name");

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error("Error fetching clients:", error);
      toast({
        title: "Error",
        description: "Failed to load clients",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingAllocations = async () => {
    try {
      const { data, error } = await supabase
        .from("allocations")
        .select("model_trade_id, client_id, contracts")
        .in("model_trade_id", modelTrades.map(t => t.id));

      if (error) throw error;

      const allocationMap: Record<string, Record<string, number>> = {};
      data?.forEach((allocation) => {
        if (!allocationMap[allocation.model_trade_id]) {
          allocationMap[allocation.model_trade_id] = {};
        }
        allocationMap[allocation.model_trade_id][allocation.client_id] = allocation.contracts;
      });
      setAllocations(allocationMap);
    } catch (error) {
      console.error("Error fetching allocations:", error);
    }
  };

  const updateAllocation = (modelTradeId: string, clientId: string, contracts: string) => {
    const value = parseInt(contracts) || 0;
    setAllocations((prev) => ({
      ...prev,
      [modelTradeId]: {
        ...(prev[modelTradeId] || {}),
        [clientId]: value,
      },
    }));
  };

  const getTotalContracts = (modelTradeId: string) => {
    return Object.values(allocations[modelTradeId] || {}).reduce((sum, val) => sum + val, 0);
  };

  const getClientTotal = (clientId: string) => {
    return modelTrades.reduce((sum, trade) => {
      const contracts = allocations[trade.id]?.[clientId] || 0;
      return sum + contracts;
    }, 0);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // First, delete existing allocations for these model trades
      const { error: deleteError } = await supabase
        .from("allocations")
        .delete()
        .in("model_trade_id", modelTrades.map(t => t.id));

      if (deleteError) throw deleteError;

      // Prepare new allocations
      const allocationsToInsert = [];
      for (const trade of modelTrades) {
        const tradeAllocations = allocations[trade.id] || {};
        for (const [clientId, contracts] of Object.entries(tradeAllocations)) {
          if (contracts > 0) {
            allocationsToInsert.push({
              model_trade_id: trade.id,
              client_id: clientId,
              advisor_id: user.id,
              contracts,
              estimated_premium_total: contracts * trade.target_premium * 100,
              source: "ADVISOR_ALLOCATION",
            });
          }
        }
      }

      // Insert new allocations
      if (allocationsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("allocations")
          .insert(allocationsToInsert);

        if (insertError) throw insertError;
      }

      // Create positions for each allocation
      for (const allocation of allocationsToInsert) {
        const trade = modelTrades.find(t => t.id === allocation.model_trade_id);
        const client = clients.find(c => c.id === allocation.client_id);
        
        if (trade && client && client.user_id) {
          await supabase.from("positions").insert({
            user_id: client.user_id,
            symbol: trade.underlying,
            strike_price: trade.strike,
            expiration: trade.expiration,
            contracts: allocation.contracts,
            premium_per_contract: trade.target_premium,
            allocation_id: allocation.model_trade_id,
            source: "ADVISOR_ALLOCATION",
            is_active: true,
          });
        }
      }

      toast({
        title: "Success",
        description: `Allocated ${allocationsToInsert.length} trades to clients`,
      });

      onComplete();
    } catch (error) {
      console.error("Error saving allocations:", error);
      toast({
        title: "Error",
        description: "Failed to save allocations",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Allocate Trades to Clients</DialogTitle>
          <DialogDescription>
            Enter the number of contracts to allocate for each client. The system will
            automatically create positions in each client's dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px] sticky left-0 bg-background z-10">
                  Trade
                </TableHead>
                {clients.map((client) => (
                  <TableHead key={client.id} className="text-center min-w-[120px]">
                    <div className="flex flex-col">
                      <span className="font-semibold">{client.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ${(client.available_cash || 0).toLocaleString()}
                      </span>
                    </div>
                  </TableHead>
                ))}
                <TableHead className="text-center font-semibold">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modelTrades.map((trade) => (
                <TableRow key={trade.id}>
                  <TableCell className="sticky left-0 bg-background z-10">
                    <div className="flex flex-col">
                      <span className="font-medium">{trade.underlying}</span>
                      <span className="text-xs text-muted-foreground">
                        ${trade.strike} · {new Date(trade.expiration).toLocaleDateString()}
                      </span>
                    </div>
                  </TableCell>
                  {clients.map((client) => (
                    <TableCell key={client.id} className="text-center">
                      <Input
                        type="number"
                        min="0"
                        value={allocations[trade.id]?.[client.id] || ""}
                        onChange={(e) =>
                          updateAllocation(trade.id, client.id, e.target.value)
                        }
                        className="w-20 text-center mx-auto"
                        placeholder="0"
                      />
                    </TableCell>
                  ))}
                  <TableCell className="text-center font-semibold">
                    {getTotalContracts(trade.id)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50">
                <TableCell className="font-semibold sticky left-0 bg-muted/50 z-10">
                  Total per Client
                </TableCell>
                {clients.map((client) => (
                  <TableCell key={client.id} className="text-center font-semibold">
                    {getClientTotal(client.id)}
                  </TableCell>
                ))}
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Allocations & Create Positions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
