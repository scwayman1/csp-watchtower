import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PositionsTable, Position } from "./PositionsTable";
import { cn } from "@/lib/utils";

interface BatchRowProps {
  batchDate: string;
  positions: Position[];
  onRefetch?: () => void;
  onRefetchAssigned?: () => void;
}

export function BatchRow({ batchDate, positions, onRefetch, onRefetchAssigned }: BatchRowProps) {
  const [isOpen, setIsOpen] = useState(false);

  const totalPremium = positions.reduce((sum, p) => sum + p.totalPremium, 0);
  const totalUnrealizedPnL = positions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
  const contractsCount = positions.reduce((sum, p) => sum + p.contracts, 0);
  
  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer transition-colors border-b">
          <div className="flex items-center gap-4 flex-1">
            <ChevronRight className={cn(
              "h-5 w-5 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-90"
            )} />
            
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Batch Date</div>
                <div className="font-semibold">{formatDate(batchDate)}</div>
              </div>
              
              <div>
                <div className="text-sm text-muted-foreground">Positions</div>
                <div className="font-semibold">{positions.length} position{positions.length !== 1 ? 's' : ''}</div>
                <div className="text-xs text-muted-foreground">{contractsCount} contract{contractsCount !== 1 ? 's' : ''}</div>
              </div>
              
              <div>
                <div className="text-sm text-muted-foreground">Total Premium</div>
                <div className="font-semibold">{formatCurrency(totalPremium)}</div>
              </div>
              
              <div>
                <div className="text-sm text-muted-foreground">Unrealized P/L</div>
                <div className={cn(
                  "font-semibold",
                  totalUnrealizedPnL >= 0 ? "text-success" : "text-destructive"
                )}>
                  {formatCurrency(totalUnrealizedPnL)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
        <div className="p-4 bg-muted/20">
          <PositionsTable 
            positions={positions}
            onRefetch={onRefetch}
            onRefetchAssigned={onRefetchAssigned}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
