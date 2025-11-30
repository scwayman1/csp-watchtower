import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { AllocationMatrix } from "@/components/advisor/AllocationMatrix";
import { CreateCycleDialog } from "@/components/advisor/CreateCycleDialog";
import { AddModelTradeDialog } from "@/components/advisor/AddModelTradeDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Cycle {
  id: string;
  name: string;
  start_date: string;
  status: string;
}

interface ModelTrade {
  id: string;
  cycle_id: string;
  strategy: string;
  underlying: string;
  strike: number;
  expiration: string;
  target_premium: number;
  risk_level: string | null;
}

export default function CycleSheetPage() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<string | null>(null);
  const [modelTrades, setModelTrades] = useState<ModelTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllocationMatrix, setShowAllocationMatrix] = useState(false);
  const [showCreateCycle, setShowCreateCycle] = useState(false);
  const [showAddTrade, setShowAddTrade] = useState(false);

  useEffect(() => {
    fetchCycles();
  }, []);

  useEffect(() => {
    if (selectedCycle) {
      fetchModelTrades(selectedCycle);
    }
  }, [selectedCycle]);

  const fetchCycles = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("cycles")
        .select("*")
        .eq("advisor_id", user.id)
        .order("start_date", { ascending: false });

      if (error) throw error;
      setCycles(data || []);
      if (data && data.length > 0) {
        setSelectedCycle(data[0].id);
      }
    } catch (error) {
      console.error("Error fetching cycles:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchModelTrades = async (cycleId: string) => {
    try {
      const { data, error } = await supabase
        .from("model_trades")
        .select("*")
        .eq("cycle_id", cycleId)
        .order("created_at");

      if (error) throw error;
      setModelTrades(data || []);
    } catch (error) {
      console.error("Error fetching model trades:", error);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "DRAFT": return "outline";
      case "PUBLISHED": return "default";
      case "CLOSED": return "secondary";
      default: return "outline";
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48"></div>
          <div className="h-64 bg-muted rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">CycleSheet</h1>
          <p className="text-muted-foreground mt-1">
            Manage option cycles and model trades
          </p>
        </div>
        <Button onClick={() => setShowCreateCycle(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Cycle
        </Button>
      </div>

      {cycles.length === 0 ? (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">No cycles found</p>
            <Button className="mt-4" variant="outline" onClick={() => setShowCreateCycle(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Cycle
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Active Cycles</CardTitle>
                <div className="flex gap-2">
                  {cycles.map((cycle) => (
                    <Button
                      key={cycle.id}
                      variant={selectedCycle === cycle.id ? "default" : "outline"}
                      onClick={() => setSelectedCycle(cycle.id)}
                      className="gap-2"
                    >
                      {cycle.name}
                      <Badge variant={getStatusBadgeVariant(cycle.status)}>
                        {cycle.status}
                      </Badge>
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
          </Card>

          {selectedCycle && (
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Model Trades</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowAddTrade(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Trade
                    </Button>
                    <Button 
                      onClick={() => setShowAllocationMatrix(true)}
                      disabled={modelTrades.length === 0}
                    >
                      Allocate to Clients
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {modelTrades.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No model trades in this cycle</p>
                    <Button className="mt-4" variant="outline" onClick={() => setShowAddTrade(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Trade
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Strategy</TableHead>
                        <TableHead>Underlying</TableHead>
                        <TableHead>Strike</TableHead>
                        <TableHead>Expiration</TableHead>
                        <TableHead>Target Premium</TableHead>
                        <TableHead>Risk Level</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {modelTrades.map((trade) => (
                        <TableRow key={trade.id}>
                          <TableCell>
                            <Badge variant="outline">{trade.strategy}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">{trade.underlying}</TableCell>
                          <TableCell>${trade.strike}</TableCell>
                          <TableCell>{new Date(trade.expiration).toLocaleDateString()}</TableCell>
                          <TableCell className="text-green-500">
                            ${trade.target_premium.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              trade.risk_level === "LOW" ? "default" :
                              trade.risk_level === "MEDIUM" ? "secondary" : "destructive"
                            }>
                              {trade.risk_level || "N/A"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {showAllocationMatrix && selectedCycle && (
        <AllocationMatrix
          cycleId={selectedCycle}
          modelTrades={modelTrades}
          onClose={() => setShowAllocationMatrix(false)}
          onComplete={() => {
            setShowAllocationMatrix(false);
            fetchModelTrades(selectedCycle);
          }}
        />
      )}

      <CreateCycleDialog
        open={showCreateCycle}
        onClose={() => setShowCreateCycle(false)}
        onSuccess={() => {
          setShowCreateCycle(false);
          fetchCycles();
        }}
      />

      {selectedCycle && (
        <AddModelTradeDialog
          open={showAddTrade}
          onClose={() => setShowAddTrade(false)}
          onSuccess={() => {
            setShowAddTrade(false);
            fetchModelTrades(selectedCycle);
          }}
          cycleId={selectedCycle}
        />
      )}
    </div>
  );
}
