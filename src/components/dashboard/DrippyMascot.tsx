import { useMemo } from "react";
import drippyConfident from "@/assets/drippy-confident.png";
import drippyNervous from "@/assets/drippy-nervous.png";
import drippySweating from "@/assets/drippy-sweating.png";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DrippyMascotProps {
  atRiskCount: number;
  warningCount: number;
  totalPositions: number;
}

export function DrippyMascot({ atRiskCount, warningCount, totalPositions }: DrippyMascotProps) {
  const { mood, message } = useMemo(() => {
    if (totalPositions === 0) {
      return {
        mood: "confident",
        message: "No positions yet! Let's get started!"
      };
    }

    const riskPercentage = (atRiskCount / totalPositions) * 100;
    const warningPercentage = (warningCount / totalPositions) * 100;

    if (riskPercentage > 30) {
      return {
        mood: "sweating",
        message: "Whoa! Multiple positions are near assignment. Stay alert!"
      };
    } else if (riskPercentage > 0) {
      return {
        mood: "nervous",
        message: "Some positions are getting close to strike. Keep an eye on them!"
      };
    } else if (warningPercentage > 50) {
      return {
        mood: "nervous",
        message: "Several positions in warning zone. Watch the tides!"
      };
    } else {
      return {
        mood: "confident",
        message: "Looking good! Your positions are sailing smoothly!"
      };
    }
  }, [atRiskCount, warningCount, totalPositions]);

  const drippyImage = mood === "confident" ? drippyConfident : mood === "nervous" ? drippyNervous : drippySweating;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative">
            <img 
              src={drippyImage} 
              alt="Drippy mascot" 
              className="w-12 h-12 sm:w-16 sm:h-16 transition-all duration-300 hover:scale-110 cursor-pointer animate-[bounce_2s_ease-in-out_infinite]"
            />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{message}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
