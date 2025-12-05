import { useState } from "react";
import { ChevronRight, TrendingUp, Sparkles } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LearningExpiredPosition } from "@/hooks/useLearningExpiredPositions";

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

  if (month === 10) return themes.thanksgiving;
  if (month === 11 || month === 0 || month === 1) return themes.winter;
  if (month >= 2 && month <= 4) return themes.spring;
  if (month >= 5 && month <= 7) return themes.summer;
  return themes.fall;
};

interface LearningBatchProps {
  date: string;
  positions: LearningExpiredPosition[];
  totalPremium: number;
  totalContracts: number;
}

function LearningBatchRow({ date, positions, totalPremium, totalContracts }: LearningBatchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const theme = getBatchTheme(date);

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    const [year, month, day] = dateString.split("-");
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div className={cn(
          "relative flex items-center justify-between p-5 cursor-pointer transition-all duration-300 border-b border-border/50",
          "bg-gradient-to-r",
          theme.gradient,
          "hover:shadow-lg hover:scale-[1.01]",
          isOpen && "shadow-md scale-[1.01]"
        )}>
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
            
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4">
              <div>
                <div className="text-xs text-muted-foreground/70 uppercase tracking-wide mb-1">Expiration</div>
                <div className={cn("font-bold text-lg", theme.textAccent)}>{formatDate(date)}</div>
              </div>
              
              <div>
                <div className="text-xs text-muted-foreground/70 uppercase tracking-wide mb-1">Positions</div>
                <div className="font-semibold text-lg">{positions.length}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/50" />
                  {totalContracts} contract{totalContracts !== 1 ? 's' : ''}
                </div>
              </div>
              
              <div>
                <div className="text-xs text-muted-foreground/70 uppercase tracking-wide mb-1">Total Premium</div>
                <div className={cn("font-bold text-lg text-success")}>{formatCurrency(totalPremium)}</div>
              </div>
              
              <div>
                <div className="text-xs text-muted-foreground/70 uppercase tracking-wide mb-1 flex items-center gap-1">
                  Status
                  <TrendingUp className="h-3 w-3 text-success" />
                </div>
                <div className="font-bold text-lg text-success">
                  Realized
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
          <div className="rounded-lg border border-success/30 bg-success/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-success/20 bg-success/10">
                    <th className="text-left p-3 text-xs font-semibold text-success uppercase tracking-wider">Symbol</th>
                    <th className="text-right p-3 text-xs font-semibold text-success uppercase tracking-wider">Contracts</th>
                    <th className="text-right p-3 text-xs font-semibold text-success uppercase tracking-wider">Strike</th>
                    <th className="text-right p-3 text-xs font-semibold text-success uppercase tracking-wider">Premium/Contract</th>
                    <th className="text-right p-3 text-xs font-semibold text-success uppercase tracking-wider">Total Premium</th>
                    <th className="text-right p-3 text-xs font-semibold text-success uppercase tracking-wider">Final Price</th>
                    <th className="text-right p-3 text-xs font-semibold text-success uppercase tracking-wider">% Above Strike</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos) => {
                    const pctAbove = pos.underlyingPrice > 0 
                      ? ((pos.underlyingPrice - pos.strike_price) / pos.strike_price) * 100 
                      : 0;
                    return (
                      <tr key={pos.id} className="border-b border-success/10 hover:bg-success/10 transition-colors">
                        <td className="p-3">
                          <span className="font-semibold text-foreground">{pos.symbol}</span>
                        </td>
                        <td className="p-3 text-right">
                          <span className="font-semibold text-foreground">{pos.contracts}</span>
                        </td>
                        <td className="p-3 text-right text-muted-foreground">
                          {formatCurrency(pos.strike_price)}
                        </td>
                        <td className="p-3 text-right text-muted-foreground">
                          {formatCurrency(pos.premium_per_contract)}
                        </td>
                        <td className="p-3 text-right">
                          <span className="font-semibold text-success">
                            {formatCurrency(pos.totalPremium)}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <span className="font-medium text-foreground">
                            {pos.underlyingPrice > 0 ? formatCurrency(pos.underlyingPrice) : '-'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          {pos.underlyingPrice > 0 ? (
                            <span className={cn(
                              "font-semibold",
                              pctAbove >= 10 ? "text-success" : pctAbove >= 5 ? "text-warning" : "text-muted-foreground"
                            )}>
                              {pctAbove >= 0 ? '+' : ''}{pctAbove.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-success/30 bg-success/10">
                    <td className="p-3 text-xs font-semibold text-success uppercase">Total</td>
                    <td className="p-3 text-right font-bold text-foreground">
                      {totalContracts}
                    </td>
                    <td className="p-3"></td>
                    <td className="p-3"></td>
                    <td className="p-3 text-right font-bold text-success">
                      {formatCurrency(totalPremium)}
                    </td>
                    <td className="p-3"></td>
                    <td className="p-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2 italic">
            These positions expired out-of-the-money. Full premium was kept.
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface LearningExpiredBatchesProps {
  batches: {
    date: string;
    positions: LearningExpiredPosition[];
    totalPremium: number;
    totalContracts: number;
  }[];
}

export function LearningExpiredBatches({ batches }: LearningExpiredBatchesProps) {
  if (batches.length === 0) return null;

  const totalPremiumAllBatches = batches.reduce((sum, b) => sum + b.totalPremium, 0);
  const totalContractsAllBatches = batches.reduce((sum, b) => sum + b.totalContracts, 0);

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-success" />
          Expired Positions (Realized Premium)
        </CardTitle>
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>{batches.length} batch{batches.length !== 1 ? 'es' : ''}</span>
          <span>•</span>
          <span>{totalContractsAllBatches} contracts</span>
          <span>•</span>
          <span className="text-success font-semibold">{formatCurrency(totalPremiumAllBatches)} realized</span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="rounded-lg overflow-hidden border">
          {batches.map((batch) => (
            <LearningBatchRow
              key={batch.date}
              date={batch.date}
              positions={batch.positions}
              totalPremium={batch.totalPremium}
              totalContracts={batch.totalContracts}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
