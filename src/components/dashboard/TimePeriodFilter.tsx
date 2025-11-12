import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";

export type TimePeriod = "all" | "mtd" | "ytd" | "custom";

interface TimePeriodFilterProps {
  selectedPeriod: TimePeriod;
  onPeriodChange: (period: TimePeriod) => void;
  customDateRange?: DateRange;
  onCustomDateRangeChange: (range: DateRange | undefined) => void;
}

export function TimePeriodFilter({
  selectedPeriod,
  onPeriodChange,
  customDateRange,
  onCustomDateRangeChange,
}: TimePeriodFilterProps) {
  const isMobile = useIsMobile();
  
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs sm:text-sm font-medium text-muted-foreground">View:</span>
      <div className="flex flex-wrap gap-1 sm:gap-2">
        <Button
          variant={selectedPeriod === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => onPeriodChange("all")}
        >
          All Time
        </Button>
        <Button
          variant={selectedPeriod === "mtd" ? "default" : "outline"}
          size="sm"
          onClick={() => onPeriodChange("mtd")}
        >
          MTD
        </Button>
        <Button
          variant={selectedPeriod === "ytd" ? "default" : "outline"}
          size="sm"
          onClick={() => onPeriodChange("ytd")}
        >
          YTD
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={selectedPeriod === "custom" ? "default" : "outline"}
              size="sm"
              className={cn(
                "justify-start text-left font-normal text-xs sm:text-sm",
                !customDateRange && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              {customDateRange?.from ? (
                customDateRange.to ? (
                  <>
                    {format(customDateRange.from, isMobile ? "M/d" : "MMM d")} -{" "}
                    {format(customDateRange.to, isMobile ? "M/d/yy" : "MMM d, yyyy")}
                  </>
                ) : (
                  format(customDateRange.from, isMobile ? "M/d/yyyy" : "MMM d, yyyy")
                )
              ) : (
                "Custom"
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={customDateRange?.from}
              selected={customDateRange}
              onSelect={(range) => {
                onCustomDateRangeChange(range);
                if (range?.from) {
                  onPeriodChange("custom");
                }
              }}
              numberOfMonths={isMobile ? 1 : 2}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
