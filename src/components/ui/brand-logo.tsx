"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function BrandLogo({ size = "md", className }: BrandLogoProps) {
  const sizeClasses = {
    sm: "w-9 h-9 p-1 rounded-xl",
    md: "w-10 h-10 p-1 rounded-xl",
    lg: "w-12 h-12 p-1.5 rounded-2xl",
  };

  return (
    <div
      className={cn(
        "shrink-0 bg-white border border-slate-200/90 shadow-sm flex items-center justify-center overflow-hidden",
        sizeClasses[size],
        className
      )}
    >
      <img
        src="/logo-creative-team.png"
        alt="Creative Team Logo"
        className="w-full h-full object-contain"
      />
    </div>
  );
}
