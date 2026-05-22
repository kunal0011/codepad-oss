import * as React from "react";
import { cn } from "../utils.js";

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "glass" | "glass-heavy" | "solid";
  hoverEffect?: boolean;
}

export const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  ({ className, variant = "glass", hoverEffect = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl border transition-all duration-300",
          variant === "glass" && "border-white/10 bg-white/[0.02] backdrop-blur-xl",
          variant === "glass-heavy" && "border-white/10 bg-[#090d1f]/80 backdrop-blur-2xl shadow-2xl",
          variant === "solid" && "border-slate-800 bg-slate-900 shadow-lg",
          hoverEffect && "hover:border-primary/30 hover:shadow-[0_0_20px_rgba(59,130,246,0.1)]",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Panel.displayName = "Panel";
