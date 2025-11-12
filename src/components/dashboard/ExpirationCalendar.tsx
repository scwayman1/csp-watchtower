import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, TrendingDown } from "lucide-react";
import { Position } from "@/components/dashboard/PositionsTable";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ExpirationCalendarProps {
  positions: Position[];
}

export function ExpirationCalendar({ positions }: ExpirationCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  // Group positions by expiration date
  const positionsByDate = positions.reduce((acc, position) => {
    const dateKey = position.expiration;
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(position);
    return acc;
  }, {} as Record<string, Position[]>);

  // Get all expiration dates
  const expirationDates = Object.keys(positionsByDate).map(dateStr => new Date(dateStr));

  // Get positions expiring in the next 30 days
  const today = new Date();
  const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const upcomingExpirations = Object.entries(positionsByDate)
    .map(([dateStr, positions]) => ({
      date: new Date(dateStr),
      dateStr,
      positions,
      totalContracts: positions.reduce((sum, p) => sum + p.contracts, 0),
      totalPremium: positions.reduce((sum, p) => sum + p.totalPremium, 0),
    }))
    .filter(item => item.date >= today && item.date <= thirtyDaysFromNow)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const selectedDatePositions = selectedDate
    ? positionsByDate[selectedDate.toISOString().split('T')[0]]
    : null;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  const formatDateShort = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getDaysUntil = (date: Date) => {
    const days = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const getBadgeVariant = (band: string): "success" | "warning" | "destructive" | "default" => {
    if (band === "success") return "success";
    if (band === "warning") return "warning";
    if (band === "destructive") return "destructive";
    return "default";
  };

  return (
    <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
      {/* Calendar View */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Expiration Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            className={cn("rounded-md border pointer-events-auto")}
            modifiers={{
              expiration: expirationDates,
            }}
            modifiersClassNames={{
              expiration: "bg-primary text-primary-foreground font-bold relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:rounded-full after:bg-primary-foreground",
            }}
          />
          
          {selectedDatePositions && (
            <div className="mt-4 space-y-2">
              <h4 className="font-semibold text-sm">
                Expiring on {selectedDate?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </h4>
              <div className="space-y-2">
                {selectedDatePositions.map(position => (
                  <div key={position.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div>
                      <div className="font-medium">{position.symbol}</div>
                      <div className="text-xs text-muted-foreground">
                        {position.contracts} contracts @ ${position.strikePrice}
                      </div>
                    </div>
                    <Badge variant={getBadgeVariant(position.statusBand)}>
                      {position.pctAboveStrike >= 0 ? '+' : ''}{position.pctAboveStrike.toFixed(1)}%
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timeline View - Next 30 Days */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Upcoming Expirations (30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {upcomingExpirations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No expirations in the next 30 days</p>
            ) : (
              upcomingExpirations.map((item) => {
                const daysUntil = getDaysUntil(item.date);
                const urgency = daysUntil <= 7 ? 'destructive' : daysUntil <= 14 ? 'warning' : 'default';
                
                return (
                  <div key={item.dateStr} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={urgency as any}>
                          {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil} days`}
                        </Badge>
                        <span className="font-semibold">{formatDateShort(item.date)}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {item.totalContracts} contracts
                      </div>
                    </div>
                    
                    <div className="pl-4 border-l-2 border-border space-y-1.5">
                      {item.positions.map(position => (
                        <TooltipProvider key={position.id}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{position.symbol}</span>
                                  <Badge variant={getBadgeVariant(position.statusBand)} className="text-xs">
                                    {position.pctAboveStrike >= 0 ? '+' : ''}{position.pctAboveStrike.toFixed(1)}%
                                  </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {position.contracts} × ${position.strikePrice}
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="space-y-1">
                                <div className="font-semibold">{position.symbol} - {position.underlyingName}</div>
                                <div className="text-xs space-y-0.5">
                                  <div>Premium: {formatCurrency(position.totalPremium)}</div>
                                  <div>Unrealized P/L: <span className={position.unrealizedPnL >= 0 ? 'text-success' : 'text-destructive'}>{formatCurrency(position.unrealizedPnL)}</span></div>
                                  <div>Assignment Prob: {position.probAssignment.toFixed(1)}%</div>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ))}
                    </div>
                    
                    <div className="text-xs text-muted-foreground pl-4">
                      Total Premium: {formatCurrency(item.totalPremium)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
