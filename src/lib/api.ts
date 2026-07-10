import type { CampaignDetail, CampaignSummary, ContributionDto, PaginatedResponse } from "@/types/campaign"

// This module is used from Server Components (page.tsx), which run inside the
// Next.js server process, not the browser — so in Docker Compose it must reach
// the backend via its service name, not `localhost` (which would mean "this
// container"). `API_URL` (server-only) covers that; `NEXT_PUBLIC_API_URL` is
// for any future client-side callers, which run in the browser outside Docker's
// network and so need the externally-published URL instead.
const API_URL =
  typeof window === "undefined"
    ? process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
    : process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { ...init, cache: "no-store" })
  if (!res.ok) {
    throw new Error(`API request failed: ${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export async function getCampaigns(params?: {
  status?: "active" | "successful" | "failed" | "all"
  sort?: "newest" | "endingSoon" | "mostFunded"
  page?: number
  pageSize?: number
}): Promise<PaginatedResponse<CampaignSummary>> {
  const query = new URLSearchParams()
  if (params?.status) query.set("status", params.status)
  if (params?.sort) query.set("sort", params.sort)
  if (params?.page) query.set("page", String(params.page))
  if (params?.pageSize) query.set("pageSize", String(params.pageSize))
  const qs = query.toString()
  return apiFetch<PaginatedResponse<CampaignSummary>>(`/campaigns${qs ? `?${qs}` : ""}`)
}

export async function getCampaign(id: string): Promise<CampaignDetail> {
  return apiFetch<CampaignDetail>(`/campaigns/${id}`)
}

export async function getContributions(id: string, page = 1, pageSize = 20): Promise<PaginatedResponse<ContributionDto>> {
  return apiFetch<PaginatedResponse<ContributionDto>>(`/campaigns/${id}/contributions?page=${page}&pageSize=${pageSize}`)
}
