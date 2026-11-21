import React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "emerald" | "amber" | "crimson" | "cyan" | "purple" | "pink" | "orange" | "sky" | "neutral";
  pulse?: boolean;
}

export function Badge({
  className,
  variant = "neutral",
  pulse = false,
  children,
  ...props
}: BadgeProps) {
  const variantStyles = {
    neutral: "bg-slate-100 text-slate-700 border-slate-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    crimson: "bg-rose-50 text-rose-700 border-rose-200",
    cyan: "bg-cyan-50 text-cyan-700 border-cyan-200",
    purple: "bg-indigo-50 text-indigo-700 border-indigo-200",
    pink: "bg-pink-50 text-pink-700 border-pink-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    sky: "bg-sky-50 text-sky-700 border-sky-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide border uppercase",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
      )}
      {children}
    </span>
  );
}
