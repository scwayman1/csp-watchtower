import * as React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface TooltipRowProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  valueClassName?: string;
  isTotal?: boolean;
}

export const TooltipRow = ({ 
  label, 
  value, 
  icon: Icon,
  valueClassName,
  isTotal 
}: TooltipRowProps) => (
  <div className={cn(
    "flex items-center justify-between gap-4 py-1.5",
    isTotal && "border-t border-border/50 pt-2.5 mt-1"
  )}>
    <span className={cn(
      "flex items-center gap-2",
      isTotal ? "font-semibold text-foreground" : "text-muted-foreground"
    )}>
      {Icon && <Icon className="h-3.5 w-3.5 opacity-70" />}
      {label}
    </span>
    <span className={cn(
      "font-mono tabular-nums",
      isTotal ? "font-bold text-base" : "font-medium",
      valueClassName
    )}>
      {value}
    </span>
  </div>
);

interface TooltipHeaderProps {
  icon?: LucideIcon;
  iconClassName?: string;
  title: string;
  badge?: string;
  badgeVariant?: "default" | "success" | "warning" | "destructive";
}

export const TooltipHeader = ({ 
  icon: Icon, 
  iconClassName,
  title,
  badge,
  badgeVariant = "default"
}: TooltipHeaderProps) => {
  const badgeColors = {
    default: "bg-primary/20 text-primary",
    success: "bg-success/20 text-success",
    warning: "bg-warning/20 text-warning",
    destructive: "bg-destructive/20 text-destructive"
  };

  return (
    <div className="flex items-center justify-between mb-3">
      <h4 className="font-semibold text-sm flex items-center gap-2">
        {Icon && (
          <div className={cn(
            "p-1 rounded-md bg-muted",
            iconClassName
          )}>
            <Icon className="h-3.5 w-3.5" />
          </div>
        )}
        {title}
      </h4>
      {badge && (
        <span className={cn(
          "text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wide",
          badgeColors[badgeVariant]
        )}>
          {badge}
        </span>
      )}
    </div>
  );
};

interface TooltipChartWrapperProps {
  label: string;
  children: React.ReactNode;
}

export const TooltipChartWrapper = ({ label, children }: TooltipChartWrapperProps) => (
  <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-muted/50 to-muted/30 p-3 mb-3 border border-border/30">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
      {label}
    </div>
    {children}
    {/* Decorative gradient overlay */}
    <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent pointer-events-none" />
  </div>
);

interface TooltipContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const TooltipContainer = ({ children, className }: TooltipContainerProps) => (
  <div className={cn(
    "space-y-0 text-sm",
    className
  )}>
    {children}
  </div>
);

interface TooltipPositionRowProps {
  symbol: string;
  detail: string;
  value: string | number;
  valueClassName?: string;
  indicator?: "positive" | "negative" | "warning" | "neutral";
}

export const TooltipPositionRow = ({ 
  symbol, 
  detail, 
  value,
  valueClassName,
  indicator
}: TooltipPositionRowProps) => {
  const indicatorColors = {
    positive: "bg-success",
    negative: "bg-destructive",
    warning: "bg-warning",
    neutral: "bg-muted-foreground"
  };

  return (
    <div className="flex items-center justify-between gap-3 py-1.5 group hover:bg-muted/30 -mx-2 px-2 rounded transition-colors">
      <div className="flex items-center gap-2 min-w-0">
        {indicator && (
          <div className={cn(
            "w-1.5 h-1.5 rounded-full flex-shrink-0",
            indicatorColors[indicator]
          )} />
        )}
        <span className="font-medium text-foreground truncate">{symbol}</span>
        <span className="text-muted-foreground text-xs truncate">{detail}</span>
      </div>
      <span className={cn(
        "font-mono tabular-nums font-medium flex-shrink-0",
        valueClassName
      )}>
        {value}
      </span>
    </div>
  );
};

interface TooltipScrollAreaProps {
  children: React.ReactNode;
  maxHeight?: string;
}

export const TooltipScrollArea = ({ children, maxHeight = "max-h-40" }: TooltipScrollAreaProps) => (
  <div className={cn(
    "overflow-y-auto -mx-1 px-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent",
    maxHeight
  )}>
    {children}
  </div>
);

export const TooltipDivider = () => (
  <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent my-2" />
);

export const TooltipEmptyState = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center py-4 text-muted-foreground">
    <span className="text-2xl mb-1">✨</span>
    <span className="text-xs">{message}</span>
  </div>
);
