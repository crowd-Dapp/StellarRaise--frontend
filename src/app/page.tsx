import { Navbar } from "@/components/layout/Navbar"
import { CampaignGrid } from "@/components/CampaignGrid"
import { getCampaigns } from "@/lib/api"
import type { CampaignSummary } from "@/types/campaign"

async function fetchCampaigns(): Promise<{ campaigns: CampaignSummary[]; error: string | null }> {
  try {
    const res = await getCampaigns({ status: "all", sort: "newest" })
    return { campaigns: res.items, error: null }
  } catch {
    return { campaigns: [], error: "Could not reach the Stellar Raise backend. Is it running?" }
  }
}

export default async function Home() {
  const { campaigns, error } = await fetchCampaigns()

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

        {error ? (
          <div className="text-center py-24 text-foreground/60">
            <p className="text-lg font-medium text-red-500">{error}</p>
            <p className="text-sm mt-2">Refresh once the backend is reachable.</p>
          </div>
        ) : (
          <CampaignGrid campaigns={campaigns} />
        )}
      </main>
    </div>
  )
}
