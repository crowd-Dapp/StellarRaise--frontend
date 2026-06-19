"use client"

import React, { useEffect, useState } from "react"
import { Clock } from "lucide-react"

interface CountdownTimerProps {
  deadline: Date | string
}

export function CountdownTimer({ deadline }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number
    hours: number
    minutes: number
  }>({ days: 0, hours: 0, minutes: 0 })

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = new Date(deadline).getTime() - new Date().getTime()
      
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
        })
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0 })
      }
    }

    calculateTimeLeft()
    const timer = setInterval(calculateTimeLeft, 60000) // Update every minute
    
    return () => clearInterval(timer)
  }, [deadline])

  return (
    <div className="flex items-center gap-1.5 text-sm font-medium text-foreground/80 bg-background/50 py-1.5 px-3 rounded-md border border-card-border/50 backdrop-blur-sm">
      <Clock className="w-4 h-4 text-primary" />
      <span>{timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m</span>
    </div>
  )
}
