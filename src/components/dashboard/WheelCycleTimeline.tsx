import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { format } from "date-fns";

interface TimelineStep {
  label: string;
  date?: string;
  completed: boolean;
}

interface WheelCycleTimelineProps {
  steps: TimelineStep[];
}

export function WheelCycleTimeline({ steps }: WheelCycleTimelineProps) {
  return (
    <div className="flex items-center gap-2 py-4 overflow-x-auto">
      {steps.map((step, index) => (
        <div key={index} className="flex items-center gap-2">
          <div className="flex flex-col items-center min-w-[120px]">
            <div className="flex items-center gap-2">
              {step.completed ? (
                <CheckCircle2 className="w-5 h-5 text-success" />
              ) : (
                <Circle className="w-5 h-5 text-muted-foreground" />
              )}
              <span className={`text-sm font-medium ${step.completed ? 'text-foreground' : 'text-muted-foreground'}`}>
                {step.label}
              </span>
            </div>
            {step.date && (
              <span className="text-xs text-muted-foreground mt-1">
                {format(new Date(step.date), 'MMM dd')}
              </span>
            )}
          </div>
          {index < steps.length - 1 && (
            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}
