import React from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "emerald" | "amber" | "crimson" | "cyan" | "outline" | "ghost";
  size?: "sm" | "md" | "lg" | "xl";
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  disabled,
  children,
  ...props
}: ButtonProps) {
  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs rounded-lg min-h-[36px]",
    md: "px-4 py-2.5 text-sm rounded-xl min-h-[46px]",
    lg: "px-5 py-3 text-base rounded-xl min-h-[52px]",
    xl: "px-6 py-4 text-lg font-bold rounded-2xl min-h-[60px]",
  };

  const variantStyles = {
    primary:
      "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-md shadow-indigo-600/20 border border-indigo-500/20",
    emerald:
      "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 border border-emerald-500/20",
    amber:
      "bg-amber-500 hover:bg-amber-400 text-white font-bold shadow-md shadow-amber-500/20 border border-amber-400/20",
    crimson:
      "bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20 border border-rose-500/20",
    cyan:
      "bg-cyan-600 hover:bg-cyan-500 text-white font-bold shadow-md shadow-cyan-600/20 border border-cyan-500/20",
    outline:
      "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs",
    ghost:
      "bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900",
  };

  return (
    <button
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all active:scale-[0.98] select-none disabled:opacity-50 disabled:pointer-events-none",
        sizeStyles[size],
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
