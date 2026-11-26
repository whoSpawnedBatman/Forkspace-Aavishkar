"use client";

import * as React from "react";
import { motion } from "motion/react";

import { useReducedMotionPreference } from "@/components/motion/use-reduced-motion";

export function FadeIn({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = useReducedMotionPreference();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.18, delay: reduceMotion ? 0 : delay }}
    >
      {children}
    </motion.div>
  );
}
