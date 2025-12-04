import * as React from "react";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";

import { cn } from "@/lib/utils";

const HoverCard = HoverCardPrimitive.Root;

const HoverCardTrigger = HoverCardPrimitive.Trigger;

const HoverCardContent = React.forwardRef<
  React.ElementRef<typeof HoverCardPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Content>
>(({ className, align = "center", sideOffset = 8, ...props }, ref) => (
  <HoverCardPrimitive.Content
    ref={ref}
    align={align}
    sideOffset={sideOffset}
    className={cn(
      "z-50 w-80 rounded-xl border border-border/50 bg-popover/95 backdrop-blur-xl p-4 text-popover-foreground shadow-xl shadow-black/10 outline-none",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      "data-[state=closed]:zoom-out-98 data-[state=open]:zoom-in-98",
      "data-[state=closed]:scale-98 data-[state=open]:scale-100",
      "data-[side=bottom]:slide-in-from-top-3 data-[side=left]:slide-in-from-right-3",
      "data-[side=right]:slide-in-from-left-3 data-[side=top]:slide-in-from-bottom-3",
      "transition-all duration-200 ease-out",
      className,
    )}
    {...props}
  />
));
HoverCardContent.displayName = HoverCardPrimitive.Content.displayName;

export { HoverCard, HoverCardTrigger, HoverCardContent };
