"use client"

import React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface ProgressBarProps {
  progress: number // 0 to 100
  className?: string
}

export function ProgressBar({ progress, className }: ProgressBarProps) {
  // Ensure progress is within 0-100 bounds
  const clampedProgress = Math.min(Math.max(progress, 0), 100)

  return (
    <div className={cn("w-full bg-card-border rounded-full overflow-hidden h-3", className)}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${clampedProgress}%` }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="h-full rounded-full bg-gradient-to-r from-primary to-accent shadow-[0_0_10px_rgba(99,102,241,0.5)]"
      />
    </div>
  )
}
