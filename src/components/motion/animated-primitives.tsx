"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FADE_FAST, SPRING_SNAPPY } from "@/providers/motion-provider";

export function AnimatedCollapse({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={FADE_FAST}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: 0.045,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 10 },
        visible: {
          opacity: 1,
          y: 0,
          transition: FADE_FAST,
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedNumberBadge({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  if (value <= 0) return null;
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={value}
        initial={{ scale: 0.72, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.72, opacity: 0 }}
        transition={SPRING_SNAPPY}
        className={className}
      >
        {value}
      </motion.span>
    </AnimatePresence>
  );
}
