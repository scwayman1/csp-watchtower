import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
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
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground">View:</span>
      <div className="flex gap-1">
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
                "justify-start text-left font-normal",
                !customDateRange && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {customDateRange?.from ? (
                customDateRange.to ? (
                  <>
                    {format(customDateRange.from, "MMM d")} -{" "}
                    {format(customDateRange.to, "MMM d, yyyy")}
                  </>
                ) : (
                  format(customDateRange.from, "MMM d, yyyy")
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
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
