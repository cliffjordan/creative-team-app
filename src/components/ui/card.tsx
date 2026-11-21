import React from "react";
import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: "emerald" | "amber" | "crimson" | "cyan" | "purple" | "none";
}

export function Card({ className, glow = "none", children, ...props }: CardProps) {
  const glowStyles = {
    none: "border-slate-200/90 shadow-sm",
    emerald: "border-emerald-200 shadow-neon-emerald",
    amber: "border-amber-200 shadow-neon-amber",
    crimson: "border-rose-200 shadow-neon-crimson",
    cyan: "border-cyan-200 shadow-neon-cyan",
    purple: "border-indigo-200 shadow-neon-purple",
  };

  return (
    <div
      className={cn(
        "rounded-2xl bg-white border transition-all duration-200 p-4 text-slate-900",
        glowStyles[glow],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
