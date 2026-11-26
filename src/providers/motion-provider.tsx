"use client";

import React from "react";
import { MotionConfig } from "framer-motion";

export const SPRING_SNAPPY = {
  type: "spring" as const,
  stiffness: 420,
  damping: 32,
  mass: 0.8,
};

export const SPRING_TAB = {
  type: "spring" as const,
  stiffness: 480,
  damping: 36,
};

export const FADE_FAST = {
  duration: 0.18,
  ease: [0.22, 1, 0.36, 1] as const,
};

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
