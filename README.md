# StellarRaise--frontend

The user-facing client for **Stellar Raise**, a crowdfunding dApp built on
Stellar/Soroban. Next.js 16 (App Router) + React 19 + TypeScript, styled with
Tailwind v4, with real Freighter wallet integration and a real Soroban
contribute transaction — no mock data, no simulated transactions.

```
 you, in a browser                    stellar-raise-backend                Soroban Testnet
        │                                     │                                  │
        │  GET /campaigns  (page.tsx, SSR)    │                                  │
        ├────────────────────────────────────▶│                                  │
        │◀──── campaign list (JSON) ───────────┤                                  │
        │                                     │                                  │
        │  click "Pledge Now" → PledgeModal   │                                  │
        │  build + sign (Freighter) + submit  │                                  │
        ├─────────────────────────────────────┼─────────────────────────────────▶│
        │◀──────────────── tx result ──────────┼──────────────────────────────────┤
        │                                     │      (backend picks the          │
        │                                     │       contribution up on         │
        │                                     │       its next poll cycle)       │
```

This repo talks to two other parts of the same project:
[`stellar-raise-backend`](https://github.com/crowd-Dapp/stellar-raise-backend)
for reading campaign data (a REST API, not a direct chain query — see why
below), and directly to Soroban RPC + Freighter for the one thing the backend
deliberately doesn't do: building, signing, and submitting the actual
`contribute` transaction.

---

## Table of contents

- [Overview](#overview)
- [Architecture](#architecture)
  - [Why the backend, and why not just query the chain directly](#why-the-backend-and-why-not-just-query-the-chain-directly)
  - [Component tree](#component-tree)
- [Wallet integration](#wallet-integration)
- [Reading campaigns](#reading-campaigns)
- [The pledge flow, in detail](#the-pledge-flow-in-detail)
  - [1. Convert the user's input to base units](#1-convert-the-users-input-to-base-units)
  - [2. Build the transaction](#2-build-the-transaction)
  - [3. Sign with Freighter](#3-sign-with-freighter)
  - [4. Submit and poll for confirmation](#4-submit-and-poll-for-confirmation)
  - [Full sequence](#full-sequence)
- [Project structure](#project-structure)
- [Environment variables](#environment-variables)
- [Running locally](#running-locally)
- [Running with Docker](#running-with-docker)
- [Design notes / FAQ](#design-notes--faq)
- [A note on how this was built](#a-note-on-how-this-was-built)

---

## Overview

Stellar Raise lets backers discover campaigns and pledge Soroban-token
contributions to them, with every campaign backed by a real, independently
deployed `crowdfund` Soroban contract (see
[`stellar-raise-contracts`](https://github.com/crowd-Dapp/stellar-raise-contracts)).
This frontend is responsible for:

- **Displaying real campaigns** — title, description, funding progress,
  deadline, status — fetched from the backend's REST API.
- **Wallet connection** — Freighter connect/disconnect, with the current
  address available anywhere via a small React context.
- **The pledge/contribute flow** — the one place in the system where a real
  transaction gets built, signed by the user, and submitted to the network.

| Feature | Where |
|---|---|
| Freighter connect/disconnect | `src/context/WalletContext.tsx` |
| Campaign list + grid UI | `src/app/page.tsx`, `src/components/CampaignGrid.tsx` |
| Pledge modal + real Soroban transaction | `src/components/ui/PledgeModal.tsx`, `src/lib/soroban.ts` |
| Backend API client | `src/lib/api.ts` |

## Architecture

### Why the backend, and why not just query the chain directly

An earlier version of this frontend rendered three hardcoded mock campaigns
and faked the pledge transaction with a `setTimeout`. The obvious next step
would be to query Soroban RPC directly from the browser for the campaign
list — but that has real costs: every campaign's contract has to be
individually simulated to read its `goal()`/`deadline()`/`get_stats()`, the
`factory.campaigns()` registry is unbounded and un-paginated, and there's no
efficient way to get "all campaigns, sorted by ending soonest" without an
index somewhere. `stellar-raise-backend` exists specifically to be that
index — it does the polling and simulation work once, on an interval, and
this frontend just reads the resulting JSON.

**The one thing the frontend does *not* delegate to the backend is the
actual transaction.** `contribute()` moves real funds and requires the
user's signature — that has to happen client-side, in the user's own
browser, signed by their own wallet. The backend is explicitly read-only
(see its README); this frontend is where write access lives.

### Component tree

```
app/layout.tsx                    Wraps everything in <WalletProvider>
  └── app/page.tsx                 Server Component — fetches campaigns from
       │                            the backend at request time (see below)
       └── components/CampaignGrid.tsx    Client Component — owns which
            │                               campaign's pledge modal is open
            ├── components/ui/ProgressBar.tsx
            ├── components/ui/CountdownTimer.tsx
            └── components/ui/PledgeModal.tsx    Owns the entire pledge
                                                   transaction lifecycle
```

`page.tsx` is deliberately a Server Component (`async function Home()`, no
`"use client"`) so the initial campaign list is fetched on the server and
rendered as part of the HTML response — no loading spinner flash, and no
client-side waterfall before the user sees real data. `CampaignGrid` is a
Client Component because it owns interactive state (which pledge modal, if
any, is open).

## Wallet integration

`src/context/WalletContext.tsx` wraps `@stellar/freighter-api` in a small
React context so any component can read the connected address without
re-implementing the connect/disconnect flow:

```tsx
interface WalletContextType {
  address: string | null
  isConnecting: boolean
  error: string | null
  connect: () => Promise<void>
  disconnect: () => void
}
```

On mount, it silently checks whether the user already has Freighter
connected and previously authorized this site — so a returning user doesn't
have to click "Connect" again every page load:

```tsx
useEffect(() => {
  const checkConnection = async () => {
    const connected = await freighter.isConnected()
    if (connected) {
      const isAllowed = await freighter.isAllowed()
      if (isAllowed) {
        const pubKey = await freighter.getAddress()
        if (pubKey?.address) setAddress(pubKey.address)
      }
    }
  }
  checkConnection()
}, [])
```

Any component reaches this via the `useWallet()` hook:

```tsx
import { useWallet } from "@/context/WalletContext"

const { address, isConnecting, connect, disconnect } = useWallet()
```

## Reading campaigns

`src/lib/api.ts` is a thin typed fetch wrapper over the backend's REST API
(`getCampaigns`, `getCampaign`, `getContributions`). The one subtlety worth
knowing about is where `API_URL` resolves to, because this module runs in
two very different places:

```ts
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
```

`page.tsx` calls this at request time and degrades gracefully if the backend
is unreachable, instead of crashing the page:

```tsx
async function fetchCampaigns(): Promise<{ campaigns: CampaignSummary[]; error: string | null }> {
  try {
    const res = await getCampaigns({ status: "all", sort: "newest" })
    return { campaigns: res.items, error: null }
  } catch {
    return { campaigns: [], error: "Could not reach the Stellar Raise backend. Is it running?" }
  }
}
```

Campaign amounts (`raised`, `goal`) arrive as **decimal strings**, not JSON
numbers — Soroban token amounts are `i128` in base units, which can exceed
`Number.MAX_SAFE_INTEGER`. See the backend's README for the full rationale;
this frontend just needs to remember never to run `Number()` on them for
anything beyond display formatting.

There's also no on-chain `image` field for a campaign — `src/lib/placeholderImage.ts`
resolves a deterministic placeholder image from a hash of the contract ID,
rather than trusting or moderating a user-supplied URL:

```ts
export function getPlaceholderImage(contractId: string): string {
  let hash = 0
  for (let i = 0; i < contractId.length; i++) {
    hash = (hash * 31 + contractId.charCodeAt(i)) | 0
  }
  return PLACEHOLDER_IMAGES[Math.abs(hash) % PLACEHOLDER_IMAGES.length]
}
```

## The pledge flow, in detail

`src/lib/soroban.ts` is the one file in this repo that talks to Soroban
directly (via `@stellar/stellar-sdk`) rather than through the backend. It
implements a four-step flow, and `PledgeModal.tsx` drives all four steps in
sequence.

### 1. Convert the user's input to base units

The user types a human amount ("100"); the contract wants an `i128` in base
units. SEP-41 tokens aren't guaranteed to use 7 decimals, so the token's
actual `decimals()` is read (and cached) before converting:

```ts
/** SEP-41 tokens are not guaranteed to use 7 decimals — always read `decimals()`. */
export async function getTokenDecimals(tokenContractId: string): Promise<number> {
  const cached = decimalsCache.get(tokenContractId)
  if (cached !== undefined) return cached

  const source = new Account(READ_ONLY_SOURCE, "0")
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(new Contract(tokenContractId).call("decimals"))
    .setTimeout(30)
    .build()

  const sim = await getServer().simulateTransaction(tx)
  if (rpc.Api.isSimulationSuccess(sim) && sim.result?.retval) {
    const decimals = scValToNative(sim.result.retval) as number
    decimalsCache.set(tokenContractId, decimals)
    return decimals
  }
  return 7 // fallback only affects display/rounding, never fund safety
}

export function toBaseUnits(amount: string, decimals: number): bigint {
  const [whole, frac = ""] = amount.split(".")
  const paddedFrac = (frac + "0".repeat(decimals)).slice(0, decimals)
  return BigInt(`${whole || "0"}${paddedFrac}`)
}
```

Just like the backend, this uses `READ_ONLY_SOURCE` — a never-funded, fixed
account — because Soroban has no read-only "call" RPC method; even a getter
like `decimals()` has to be simulated as a full (unsigned, unsubmitted)
transaction.

### 2. Build the transaction

```ts
export async function buildContributeTx(campaignContractId: string, contributorAddress: string, amountBaseUnits: bigint): Promise<Transaction> {
  const account = await getServer().getAccount(contributorAddress)
  const op = new Contract(campaignContractId).call(
    "contribute",
    nativeToScVal(contributorAddress, { type: "address" }),
    nativeToScVal(amountBaseUnits, { type: "i128" }),
  )

  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(op)
    .setTimeout(30)
    .build()

  return getServer().prepareTransaction(tx) // adds Soroban resource fees + footprint
}
```

This time the *real* account (`getServer().getAccount(contributorAddress)`)
is used, not the read-only placeholder — the transaction needs the
contributor's actual current sequence number since it will really be
submitted. `prepareTransaction` is what turns a plain classic-style
transaction into a valid Soroban invocation: it runs a simulation pass to
compute the contract call's resource footprint and attaches the Soroban-specific
fee/data the network requires.

### 3. Sign with Freighter

```ts
export async function signAndSubmit(tx: Transaction, signerAddress: string): Promise<SubmitResult> {
  const networkCheck = await freighter.getNetworkDetails().catch(() => null)
  if (networkCheck?.networkPassphrase && networkCheck.networkPassphrase !== NETWORK_PASSPHRASE) {
    throw new Error(`Wrong network selected in Freighter. Expected "${NETWORK_PASSPHRASE}".`)
  }

  const signResult = await freighter.signTransaction(tx.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
    address: signerAddress,
  })
  if ("error" in signResult && signResult.error) {
    throw new Error(String(signResult.error))
  }
  const signedXdr = "signedTxXdr" in signResult ? signResult.signedTxXdr : (signResult as unknown as string)
  const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE) as Transaction
  // ...continued in step 4
```

The network check exists because Freighter lets the user pick any network in
its own UI, independent of this app — if they've switched to mainnet (or a
different testnet) without realizing it, this fails fast with a clear
message instead of the transaction silently going nowhere useful.

### 4. Submit and poll for confirmation

```ts
  const sendResult = await getServer().sendTransaction(signedTx)
  if (sendResult.status === "ERROR") {
    throw new Error("Transaction submission was rejected by the network.")
  }
  const hash = sendResult.hash

  const terminal = new Set(["SUCCESS", "FAILED"])
  for (let attempt = 0; attempt < 15; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    const statusRes = await getServer().getTransaction(hash)
    if (terminal.has(statusRes.status)) {
      return statusRes.status === "SUCCESS"
        ? { status: "SUCCESS", hash }
        : { status: "FAILED", hash, message: "Transaction failed on-chain." }
    }
  }
  throw new Error("Timed out waiting for transaction confirmation.")
}
```

`sendTransaction` only confirms the transaction was *accepted into the
mempool* — it says nothing about whether it actually succeeded. Getting a
real answer means polling `getTransaction(hash)` every 2 seconds (up to 15
attempts, 30 seconds total) until it reaches a terminal `SUCCESS`/`FAILED`
state.

### Full sequence

`PledgeModal.tsx` chains all four steps together and maps each outcome onto
the UI's `idle | processing | success | error` state machine:

```tsx
const decimals = await getTokenDecimals(campaign.token)
const amountBaseUnits = toBaseUnits(pledgeAmount, decimals)

const tx = await buildContributeTx(campaign.id, address, amountBaseUnits)
const result = await signAndSubmit(tx, address)

if (result.status === "SUCCESS") {
  setTxHash(result.hash)
  setTxState("success") // shows a link to stellar.expert for the tx hash
} else {
  setTxState("error")
  setErrorMessage(result.message)
}
```

Nothing about this is simulated or faked — a successful pledge is a real,
signed, on-chain `contribute()` call, and (once `stellar-raise-backend`'s
next event-poll cycle runs, every 15 seconds by default) it will show up in
that campaign's contribution history and updated funding total.

## Project structure

```
src/
  app/
    layout.tsx              Root layout — wraps children in <WalletProvider>
    page.tsx                 Server Component — fetches campaigns, renders grid or error state
    globals.css
  components/
    CampaignGrid.tsx           Client Component — campaign cards + owns pledge modal state
    layout/Navbar.tsx           Wallet connect/disconnect UI
    ui/
      button.tsx                 shadcn-style Button (cva variants)
      ProgressBar.tsx              Animated funding progress bar
      CountdownTimer.tsx            Countdown to campaign deadline
      PledgeModal.tsx                 The pledge transaction flow (§ above)
  context/
    WalletContext.tsx          Freighter wallet state, via React context
  lib/
    api.ts                      Backend REST API client
    soroban.ts                   Soroban transaction build/sign/submit (§ above)
    placeholderImage.ts           Deterministic campaign image fallback
    utils.ts                      cn() classnames helper
  types/
    campaign.ts                  Shared TS types matching the backend's JSON DTOs
```

## Environment variables

Copy `.env.local.example` to `.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015

# Populated by stellar-raise-contracts/scripts/deploy-testnet.sh
NEXT_PUBLIC_FACTORY_CONTRACT_ID=C...
NEXT_PUBLIC_TOKEN_CONTRACT_ID=C...
```

| Variable | Used by | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `src/lib/api.ts` (browser-side) | Must be externally reachable — the browser can't resolve Docker service names. |
| `API_URL` | `src/lib/api.ts` (server-side, Docker only) | Not in `.env.local` — set directly in `docker-compose.yml` as `http://backend:4000`. |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | `src/lib/soroban.ts` | Public testnet RPC by default; same value the backend uses. |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | `src/lib/soroban.ts` | Must match Freighter's selected network or `signAndSubmit` throws. |
| `NEXT_PUBLIC_FACTORY_CONTRACT_ID`, `NEXT_PUBLIC_TOKEN_CONTRACT_ID` | not yet read in code | Reserved for future client-side factory interaction (e.g. a "create your own campaign" flow); currently informational. |

`NEXT_PUBLIC_*` variables are inlined into the client JS bundle at build
time by Next.js — anything without that prefix stays server-only, which is
exactly why `API_URL` (no prefix) exists separately from
`NEXT_PUBLIC_API_URL` (see [Reading campaigns](#reading-campaigns)).

## Running locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Requires
`stellar-raise-backend` running and reachable at `NEXT_PUBLIC_API_URL` for
real campaign data — without it, the page still renders (see the graceful
error state in `page.tsx`), just with no campaigns.

You'll also want the
[Freighter browser extension](https://www.freighter.app/) installed and set
to Testnet to actually connect a wallet and pledge.

## Running with Docker

From the `crowd-Dapp/` repo root (one level up), the shared
`docker-compose.yml` brings up this frontend alongside the backend and
Postgres together:

```bash
docker compose up --build
```

This repo's `Dockerfile` is a three-stage build: a shared `base` stage
(installs deps), a `dev` stage used by Compose (`target: dev`, runs
`next dev` against the bind-mounted `src/` for live reload), and a
`build` → `prod` pipeline that produces a minimal `next start` production
image with no dev dependencies or source maps.

## Design notes / FAQ

**Why is `page.tsx` a Server Component instead of fetching client-side with
`useEffect`?** Server-side fetching means the campaign list is part of the
initial HTML — no loading spinner, no client-side request waterfall, and
crawlers/social previews see real content. The trade-off is the
`API_URL` vs. `NEXT_PUBLIC_API_URL` split documented above, since a
server-side fetch runs somewhere different than a client-side one would.

**Why does `PledgeModal` take a whole `CampaignSummary` object instead of
just a title string, like it used to?** The old (mock-data) version only
needed a display name because the pledge was faked. A real `contribute()`
call needs the campaign's actual contract address (`id`) and its funding
token's contract address (`token`) — both of which live on the summary
object already fetched for the grid, so there's no need for a second
network round-trip just to open the modal.

**Why poll `getTransaction` up to 15 times instead of using a websocket or
similar?** Soroban RPC's public HTTP API doesn't offer transaction status
push notifications — polling `getTransaction` is the standard pattern
`@stellar/stellar-sdk`-based clients use. 2-second intervals for up to 30
seconds comfortably covers normal Soroban confirmation times without
hammering the RPC endpoint.

## A note on how this was built

This frontend's dependencies (`@stellar/stellar-sdk`, `@stellar/freighter-api`,
Next.js, etc.) were added and the code was written in a sandboxed environment
with **no live network access**, so `npm install`, `next build`, and
`tsc --noEmit` could **not** be run here to verify the code type-checks or
that the exact installed `@stellar/stellar-sdk` API surface (e.g.
`rpc.Api.isSimulationSuccess`, `Account`, `prepareTransaction`) matches what's
used in `src/lib/soroban.ts`. Run `npm install && npm run lint && npm run build`
the first time you pick this up, and treat any type errors as likely a minor
API-surface mismatch against the installed SDK version rather than a logic
bug — the underlying flow (simulate → prepare → sign → submit → poll) is the
part that's been reasoned through carefully; exact method names are the part
most likely to need a small fix.
