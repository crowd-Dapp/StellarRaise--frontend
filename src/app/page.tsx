"use client"

import React, { useState } from "react"
import { Navbar } from "@/components/layout/Navbar"
import { ProgressBar } from "@/components/ui/ProgressBar"
import { CountdownTimer } from "@/components/ui/CountdownTimer"
import { Button } from "@/components/ui/button"
import { PledgeModal } from "@/components/ui/PledgeModal"

const mockCampaigns = [
  {
    id: "1",
    title: "Eco-Friendly Water Purification",
    description: "A compact, solar-powered water purification system for off-grid communities.",
    raised: 15400,
    goal: 20000,
    deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    image: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&q=80&w=800",
  },
  {
    id: "2",
    title: "Open Source AI Education Platform",
    description: "Democratizing AI education with free, high-quality interactive courses for everyone.",
    raised: 8200,
    goal: 50000,
    deadline: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
    image: "https://images.unsplash.com/photo-1555949963-aa79dcee5789?auto=format&fit=crop&q=80&w=800",
  },
  {
    id: "3",
    title: "Community Solar Microgrid",
    description: "Empowering neighborhoods to generate and share sustainable solar energy.",
    raised: 45000,
    goal: 45000,
    deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    image: "https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&q=80&w=800",
  },
]

export default function Home() {
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null)

  const handlePledgeClick = (title: string) => {
    setSelectedCampaign(title)
  }

  const closePledgeModal = () => {
    setSelectedCampaign(null)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="max-w-3xl mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold text-foreground mb-4">
            Fund the Future on <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Stellar</span>
          </h1>
          <p className="text-lg text-foreground/70">
            Discover and support innovative projects with lightning-fast, secure transactions on the Stellar network.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {mockCampaigns.map((campaign) => {
            const progress = (campaign.raised / campaign.goal) * 100
            const isFunded = progress >= 100

            return (
              <div 
                key={campaign.id}
                className="group flex flex-col bg-card border border-card-border rounded-2xl overflow-hidden hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 transform hover:-translate-y-1"
              >
                <div className="relative h-48 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={campaign.image} 
                    alt={campaign.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 right-3">
                    <CountdownTimer deadline={campaign.deadline} />
                  </div>
                </div>

                <div className="p-6 flex-1 flex flex-col">
                  <h3 className="text-xl font-bold text-foreground mb-2 line-clamp-1">{campaign.title}</h3>
                  <p className="text-foreground/60 text-sm mb-6 line-clamp-2 flex-1">
                    {campaign.description}
                  </p>

                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2 font-medium">
                        <span className="text-primary">{campaign.raised.toLocaleString()} XLM raised</span>
                        <span className="text-foreground/60">{campaign.goal.toLocaleString()} XLM goal</span>
                      </div>
                      <ProgressBar progress={progress} />
                    </div>

                    <Button 
                      className="w-full font-bold" 
                      variant={isFunded ? "secondary" : "default"}
                      onClick={() => !isFunded && handlePledgeClick(campaign.title)}
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
      </main>

      <PledgeModal 
        isOpen={!!selectedCampaign} 
        onClose={closePledgeModal} 
        campaignTitle={selectedCampaign || ""} 
      />
    </div>
  )
}
