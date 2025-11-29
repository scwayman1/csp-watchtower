import { useState } from "react";
import { ChevronRight, TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PositionsTable, Position } from "./PositionsTable";
import { cn } from "@/lib/utils";

interface AssignedPositionData {
  id: string;
  symbol: string;
  shares: number;
  original_put_premium: number;
  original_position_id: string | null;
}

interface BatchRowProps {
  batchDate: string;
  positions: Position[];
  assignedPositions?: AssignedPositionData[];
  onRefetch?: () => void;
  onRefetchAssigned?: () => void;
  batchIndex?: number;
}

export function BatchRow({ batchDate, positions, assignedPositions = [], onRefetch, onRefetchAssigned, batchIndex = 0 }: BatchRowProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Calculate totals including assigned positions
  const expiredPremium = positions.reduce((sum, p) => sum + p.totalPremium, 0);
  const assignedPremium = assignedPositions.reduce((sum, ap) => sum + ap.original_put_premium, 0);
  const totalPremium = expiredPremium + assignedPremium;
  
  const totalUnrealizedPnL = positions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
  const contractsCount = positions.reduce((sum, p) => sum + p.contracts, 0);
  const assignedSharesCount = assignedPositions.reduce((sum, ap) => sum + ap.shares, 0);
  const assignedContractsCount = Math.floor(assignedSharesCount / 100);
  
  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    const [year, month, day] = dateString.split("-");
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Generate gradient hue based on batch index for color variation
  const hueRotation = (batchIndex * 45) % 360;
  const gradientClass = `hue-rotate-[${hueRotation}deg]`;
  
  // Determine if this batch was profitable
  const isProfitable = totalUnrealizedPnL >= 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div className={cn(
          "relative flex items-center justify-between p-5 cursor-pointer transition-all duration-300 border-b border-border/50",
          "bg-gradient-to-r from-card/80 via-card to-card/80",
          "hover:from-accent/20 hover:via-accent/10 hover:to-accent/20",
          "hover:shadow-lg hover:scale-[1.01] hover:border-accent/30",
          isOpen && "bg-accent/10 shadow-md scale-[1.01] border-accent/50"
        )}
        style={{
          backgroundImage: `linear-gradient(to right, hsl(var(--card) / 0.8), hsl(var(--accent) / 0.05), hsl(var(--card) / 0.8))`,
        }}
        >
          {/* Accent Bar */}
          <div className={cn(
            "absolute left-0 top-0 bottom-0 w-1 transition-all duration-300",
            isProfitable ? "bg-success" : "bg-destructive",
            isOpen && "w-2"
          )} />
          
          <div className="flex items-center gap-4 flex-1 ml-2">
            <div className={cn(
              "flex items-center justify-center w-8 h-8 rounded-lg bg-accent/30 transition-all duration-300",
              isOpen && "bg-accent/50 scale-110"
            )}>
              <ChevronRight className={cn(
                "h-4 w-4 text-accent-foreground transition-transform duration-200",
                isOpen && "rotate-90"
              )} />
            </div>
            
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-5 gap-3 sm:gap-4">
              <div>
                <div className="text-xs text-muted-foreground/70 uppercase tracking-wide mb-1">Batch Date</div>
                <div className="font-bold text-lg">{formatDate(batchDate)}</div>
              </div>
              
              <div>
                <div className="text-xs text-muted-foreground/70 uppercase tracking-wide mb-1">Expired</div>
                <div className="font-semibold text-lg">{positions.length} position{positions.length !== 1 ? 's' : ''}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/50" />
                  {contractsCount} contract{contractsCount !== 1 ? 's' : ''}
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground/70 uppercase tracking-wide mb-1">Assigned</div>
                <div className="font-semibold text-lg text-warning">{assignedPositions.length} position{assignedPositions.length !== 1 ? 's' : ''}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-warning/50" />
                  {assignedContractsCount} contract{assignedContractsCount !== 1 ? 's' : ''}
                </div>
              </div>
              
              <div>
                <div className="text-xs text-muted-foreground/70 uppercase tracking-wide mb-1">Total Premium</div>
                <div className="font-bold text-lg text-primary">{formatCurrency(totalPremium)}</div>
                {assignedPremium > 0 && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatCurrency(assignedPremium)} from assigned
                  </div>
                )}
              </div>
              
              <div>
                <div className="text-xs text-muted-foreground/70 uppercase tracking-wide mb-1 flex items-center gap-1">
                  Unrealized P/L
                  {isProfitable ? (
                    <TrendingUp className="h-3 w-3 text-success" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-destructive" />
                  )}
                </div>
                <div className={cn(
                  "font-bold text-lg flex items-center gap-2",
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
        <div className="p-6 bg-accent/5 border-t border-accent/20">
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
