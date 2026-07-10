"use client"

import React, { useState } from "react"
import { ProgressBar } from "@/components/ui/ProgressBar"
import { CountdownTimer } from "@/components/ui/CountdownTimer"
import { Button } from "@/components/ui/button"
import { PledgeModal } from "@/components/ui/PledgeModal"
import { getPlaceholderImage } from "@/lib/placeholderImage"
import type { CampaignSummary } from "@/types/campaign"

interface CampaignGridProps {
  campaigns: CampaignSummary[]
}

export function CampaignGrid({ campaigns }: CampaignGridProps) {
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignSummary | null>(null)

  if (campaigns.length === 0) {
    return (
      <div className="text-center py-24 text-foreground/60">
        <p className="text-lg font-medium">No campaigns yet.</p>
        <p className="text-sm mt-2">Check back soon, or be the first to launch one.</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {campaigns.map((campaign) => {
          const progress = campaign.progressBps / 100
          const isFunded = campaign.status === "successful" || progress >= 100

          return (
            <div
              key={campaign.id}
              className="group flex flex-col bg-card border border-card-border rounded-2xl overflow-hidden hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 transform hover:-translate-y-1"
            >
              <div className="relative h-48 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getPlaceholderImage(campaign.id)}
                  alt={campaign.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-3 right-3">
                  <CountdownTimer deadline={campaign.deadline} />
                </div>
              </div>

              <div className="p-6 flex-1 flex flex-col">
                <h3 className="text-xl font-bold text-foreground mb-2 line-clamp-1">{campaign.title}</h3>
                <p className="text-foreground/60 text-sm mb-6 line-clamp-2 flex-1">{campaign.description}</p>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2 font-medium">
                      <span className="text-primary">{campaign.raised} raised</span>
                      <span className="text-foreground/60">{campaign.goal} goal</span>
                    </div>
                    <ProgressBar progress={progress} />
                  </div>

                  <Button
                    className="w-full font-bold"
                    variant={isFunded ? "secondary" : "default"}
                    onClick={() => !isFunded && setSelectedCampaign(campaign)}
                    disabled={isFunded}
                  >
                    {isFunded ? "Successfully Funded" : "Pledge Now"}
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <PledgeModal isOpen={!!selectedCampaign} onClose={() => setSelectedCampaign(null)} campaign={selectedCampaign} />
    </>
  )
}
