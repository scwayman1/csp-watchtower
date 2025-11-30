import { useState } from "react";
import { ChevronRight, TrendingUp, TrendingDown, Leaf, Snowflake, Flower, Sun, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PositionsTable, Position } from "./PositionsTable";
import { cn } from "@/lib/utils";

// Batch themes based on month
const getBatchTheme = (dateString: string) => {
  const month = new Date(dateString).getMonth();
  
  const themes = {
    thanksgiving: {
      gradient: "from-orange-500/20 via-amber-500/10 to-orange-600/20",
      accentBar: "bg-gradient-to-b from-orange-500 to-amber-600",
      icon: "🦃",
      icons: ["🦃", "🌽", "🎃", "🍂"],
      iconBg: "bg-orange-500/30",
      iconBgHover: "bg-orange-500/50",
      textAccent: "text-orange-400"
    },
    winter: {
      gradient: "from-blue-500/20 via-cyan-500/10 to-blue-600/20",
      accentBar: "bg-gradient-to-b from-blue-400 to-cyan-500",
      icon: "❄️",
      icons: ["❄️", "⛄", "🎄", "🎁"],
      iconBg: "bg-blue-500/30",
      iconBgHover: "bg-blue-500/50",
      textAccent: "text-blue-400"
    },
    spring: {
      gradient: "from-pink-500/20 via-rose-500/10 to-pink-600/20",
      accentBar: "bg-gradient-to-b from-pink-400 to-rose-500",
      icon: "🌸",
      icons: ["🌸", "🌷", "🦋", "🌼"],
      iconBg: "bg-pink-500/30",
      iconBgHover: "bg-pink-500/50",
      textAccent: "text-pink-400"
    },
    summer: {
      gradient: "from-yellow-500/20 via-amber-500/10 to-yellow-600/20",
      accentBar: "bg-gradient-to-b from-yellow-400 to-amber-500",
      icon: "☀️",
      icons: ["☀️", "🏖️", "🌊", "🍉"],
      iconBg: "bg-yellow-500/30",
      iconBgHover: "bg-yellow-500/50",
      textAccent: "text-yellow-400"
    },
    fall: {
      gradient: "from-red-500/20 via-orange-500/10 to-red-600/20",
      accentBar: "bg-gradient-to-b from-red-400 to-orange-500",
      icon: "🍂",
      icons: ["🍂", "🍁", "🎃", "🌰"],
      iconBg: "bg-red-500/30",
      iconBgHover: "bg-red-500/50",
      textAccent: "text-red-400"
    }
  };

  // November = Thanksgiving theme
  if (month === 10) return themes.thanksgiving;
  // December, January, February = Winter
  if (month === 11 || month === 0 || month === 1) return themes.winter;
  // March, April, May = Spring
  if (month >= 2 && month <= 4) return themes.spring;
  // June, July, August = Summer
  if (month >= 5 && month <= 7) return themes.summer;
  // September, October = Fall
  return themes.fall;
};

interface AssignedPositionData {
  id: string;
  symbol: string;
  shares: number;
  original_put_premium: number;
  original_position_id: string | null;
  assignment_price: number;
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

  // Get theme based on batch date
  const theme = getBatchTheme(batchDate);
  
  // Determine if this batch was profitable
  const isProfitable = totalUnrealizedPnL >= 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div className={cn(
          "relative flex items-center justify-between p-5 cursor-pointer transition-all duration-300 border-b border-border/50",
          "bg-gradient-to-r",
          theme.gradient,
          "hover:shadow-lg hover:scale-[1.01]",
          isOpen && "shadow-md scale-[1.01]"
        )}
        >
          {/* Themed Accent Bar */}
          <div className={cn(
            "absolute left-0 top-0 bottom-0 w-1 transition-all duration-300",
            theme.accentBar,
            isOpen && "w-2"
          )} />
          
          {/* Decorative themed icons in background */}
          <div className="absolute inset-0 overflow-hidden opacity-30 pointer-events-none">
            <div className="absolute top-2 right-10 text-5xl">{theme.icons[0]}</div>
            <div className="absolute bottom-2 right-32 text-4xl">{theme.icons[1]}</div>
            <div className="absolute top-1/2 right-1/4 text-3xl">{theme.icons[2]}</div>
            <div className="absolute top-4 right-1/2 text-4xl">{theme.icons[3]}</div>
            <div className="absolute bottom-4 right-16 text-3xl">{theme.icons[0]}</div>
          </div>
          
          <div className="flex items-center gap-4 flex-1 ml-2 relative z-10">
            {/* Themed icon button */}
            <div className={cn(
              "flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-300 text-xl",
              theme.iconBg,
              isOpen && theme.iconBgHover + " scale-110"
            )}>
              {theme.icon}
            </div>
            
            <div className={cn(
              "flex items-center justify-center w-8 h-8 rounded-lg bg-card/50 backdrop-blur-sm transition-all duration-300",
              isOpen && "scale-110"
            )}>
              <ChevronRight className={cn(
                "h-4 w-4 transition-transform duration-200",
                theme.textAccent,
                isOpen && "rotate-90"
              )} />
            </div>
            
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-5 gap-3 sm:gap-4">
              <div>
                <div className="text-xs text-muted-foreground/70 uppercase tracking-wide mb-1">Batch Date</div>
                <div className={cn("font-bold text-lg", theme.textAccent)}>{formatDate(batchDate)}</div>
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
                <div className={cn("font-bold text-lg", theme.textAccent)}>{formatCurrency(totalPremium)}</div>
                {assignedPremium > 0 && (
                  <div className="text-xs text-muted-foreground/80 mt-0.5">
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
        <div className={cn(
          "p-6 border-t",
          "bg-gradient-to-b",
          theme.gradient,
          "backdrop-blur-sm"
        )}>
          {/* Assigned Positions Section */}
          {assignedPositions.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1 bg-warning/30" />
                <span className="text-xs font-semibold text-warning uppercase tracking-wider px-2">
                  Assigned Positions (From This Batch)
                </span>
                <div className="h-px flex-1 bg-warning/30" />
              </div>
              <div className="rounded-lg border border-warning/30 bg-warning/5 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-warning/20 bg-warning/10">
                        <th className="text-left p-3 text-xs font-semibold text-warning uppercase tracking-wider">Symbol</th>
                        <th className="text-right p-3 text-xs font-semibold text-warning uppercase tracking-wider">Contracts</th>
                        <th className="text-right p-3 text-xs font-semibold text-warning uppercase tracking-wider">Shares</th>
                        <th className="text-right p-3 text-xs font-semibold text-warning uppercase tracking-wider">Strike</th>
                        <th className="text-right p-3 text-xs font-semibold text-warning uppercase tracking-wider">Assignment $</th>
                        <th className="text-right p-3 text-xs font-semibold text-warning uppercase tracking-wider">Put Premium</th>
                        <th className="text-right p-3 text-xs font-semibold text-warning uppercase tracking-wider">Premium/Contract</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignedPositions.map((ap) => {
                        const contracts = Math.floor(ap.shares / 100);
                        const premiumPerContract = contracts > 0 ? ap.original_put_premium / contracts : 0;
                        return (
                          <tr key={ap.id} className="border-b border-warning/10 hover:bg-warning/10 transition-colors">
                            <td className="p-3">
                              <span className="font-semibold text-foreground">{ap.symbol}</span>
                            </td>
                            <td className="p-3 text-right">
                              <span className="font-semibold text-foreground">{contracts}</span>
                            </td>
                            <td className="p-3 text-right text-muted-foreground">
                              {ap.shares.toLocaleString()}
                            </td>
                            <td className="p-3 text-right text-muted-foreground">
                              {formatCurrency(ap.assignment_price)}
                            </td>
                            <td className="p-3 text-right">
                              <span className="font-medium text-foreground">
                                {formatCurrency(ap.assignment_price * ap.shares)}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <span className="font-semibold text-success">
                                {formatCurrency(ap.original_put_premium)}
                              </span>
                            </td>
                            <td className="p-3 text-right text-muted-foreground">
                              {formatCurrency(premiumPerContract)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-warning/30 bg-warning/10">
                        <td className="p-3 text-xs font-semibold text-warning uppercase">Total</td>
                        <td className="p-3 text-right font-bold text-foreground">
                          {assignedContractsCount}
                        </td>
                        <td className="p-3 text-right font-bold text-foreground">
                          {assignedPositions.reduce((sum, ap) => sum + ap.shares, 0).toLocaleString()}
                        </td>
                        <td className="p-3"></td>
                        <td className="p-3 text-right font-bold text-foreground">
                          {formatCurrency(assignedPositions.reduce((sum, ap) => sum + (ap.assignment_price * ap.shares), 0))}
                        </td>
                        <td className="p-3 text-right font-bold text-success">
                          {formatCurrency(assignedPremium)}
                        </td>
                        <td className="p-3"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2 italic">
                These assigned positions are also shown in the Assigned Positions table above for current tracking.
              </p>
            </div>
          )}
          
          {/* Expired Positions Section */}
          {positions.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1 bg-border/50" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">
                  Expired Positions
                </span>
                <div className="h-px flex-1 bg-border/50" />
              </div>
              <PositionsTable 
                positions={positions}
                onRefetch={onRefetch}
                onRefetchAssigned={onRefetchAssigned}
              />
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
