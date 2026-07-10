export type CampaignStatus = "active" | "successful" | "failed"

export interface CampaignSummary {
  id: string // contractId
  title: string
  description: string
  raised: string // decimal-string i128, base units of the campaign's token
  goal: string
  deadline: string // ISO
  progressBps: number
  contributorCount: number
  status: CampaignStatus
  creator: string
  token: string
}

export interface CampaignDetail extends CampaignSummary {
  socials: string | null
  bonusGoal: string | null
  bonusGoalDescription: string | null
  minContribution: string
  nftContract: string | null
  version: number
}

export interface ContributionDto {
  contributor: string
  amount: string
  txHash: string
  ledger: string
  timestamp: string
}

export interface PaginatedResponse<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
}
