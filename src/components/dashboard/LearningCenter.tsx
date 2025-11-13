import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OptionPricer } from "./OptionPricer";
import { SimulatorTable } from "./SimulatorTable";
import { GraduationCap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLearningPositions } from "@/hooks/useLearningPositions";

export const LearningCenter = () => {
  const { user } = useAuth();
  const { positions, addPosition, closePosition, deletePosition } = useLearningPositions(user?.id);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleAddPosition = (position: any) => {
    addPosition(position);
    setRefreshKey(prev => prev + 1);
  };

  return (
    <Card className="mt-6 overflow-visible">
      <CardHeader>
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" />
          <CardTitle>Learning Center</CardTitle>
        </div>
        <CardDescription>
          Practice pricing cash-secured puts and simulate trades to learn without risk
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-visible">
        <Tabs defaultValue="pricer" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pricer">Option Pricer</TabsTrigger>
            <TabsTrigger value="simulator">
              My Simulator ({positions.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="pricer" className="mt-4 relative">
            <OptionPricer onAddToSimulator={handleAddPosition} />
          </TabsContent>
          <TabsContent value="simulator" className="mt-4">
            <SimulatorTable 
              positions={positions} 
              onClose={closePosition}
              onDelete={deletePosition}
              key={refreshKey}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};