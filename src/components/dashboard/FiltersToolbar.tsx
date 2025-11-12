import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, Download } from "lucide-react";

interface FiltersToolbarProps {
  onSearchChange: (value: string) => void;
  onRiskBandChange: (value: string) => void;
  onExpirationChange: (value: string) => void;
}

export function FiltersToolbar({ 
  onSearchChange, 
  onRiskBandChange, 
  onExpirationChange 
}: FiltersToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Filter by symbol..."
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <Select defaultValue="all" onValueChange={onRiskBandChange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Risk Band" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Risk Bands</SelectItem>
            <SelectItem value="safe">Safe (≥ 10%)</SelectItem>
            <SelectItem value="watch">Watch (5–10%)</SelectItem>
            <SelectItem value="risk">Risk (&lt;5%)</SelectItem>
          </SelectContent>
        </Select>

        <Select defaultValue="all" onValueChange={onExpirationChange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Expiration" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Expirations</SelectItem>
            <SelectItem value="week">≤7 days</SelectItem>
            <SelectItem value="month">8–21 days</SelectItem>
            <SelectItem value="long">22+ days</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" className="w-full sm:w-auto">
          <Download className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Export CSV</span>
          <span className="sm:hidden">Export</span>
        </Button>
      </div>
    </div>
  );
}
