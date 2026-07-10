// No on-chain field maps to a campaign image, so we resolve a deterministic
// placeholder from the contract id rather than trusting/moderating user-supplied URLs.
const PLACEHOLDER_IMAGES = [
  "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1555949963-aa79dcee5789?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=800",
]

export function getPlaceholderImage(contractId: string): string {
  let hash = 0
  for (let i = 0; i < contractId.length; i++) {
    hash = (hash * 31 + contractId.charCodeAt(i)) | 0
  }
  const index = Math.abs(hash) % PLACEHOLDER_IMAGES.length
  return PLACEHOLDER_IMAGES[index]
}
