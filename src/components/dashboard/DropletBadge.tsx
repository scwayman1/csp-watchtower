import { Droplet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DropletBadgeProps {
  milestone: string;
  achieved: boolean;
  description: string;
}

export function DropletBadge({ milestone, achieved, description }: DropletBadgeProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={achieved ? "default" : "outline"} 
            className={`flex items-center gap-1 ${achieved ? 'droplet-bounce' : 'opacity-50'}`}
          >
            <Droplet className="h-3 w-3" />
            <span className="text-xs">{milestone}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
