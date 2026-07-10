import {
  rpc,
  Contract,
  TransactionBuilder,
  Account,
  BASE_FEE,
  nativeToScVal,
  scValToNative,
  type Transaction,
} from "@stellar/stellar-sdk"
import freighter from "@stellar/freighter-api"

// Never funded, never signed for, never submitted — Soroban has no read-only
// "call" RPC method, so even a getter like `decimals()` must be simulated as
// a transaction, which only needs a syntactically valid source account.
const READ_ONLY_SOURCE = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"

const RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org"
const NETWORK_PASSPHRASE = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || "Test SDF Network ; September 2015"

let server: rpc.Server | null = null
export function getServer(): rpc.Server {
  if (!server) {
    server = new rpc.Server(RPC_URL)
  }
  return server
}

const decimalsCache = new Map<string, number>()

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
  // Fall back to the common default rather than throwing — a wrong decimals
  // guess only affects display/rounding, not fund safety (the exact base-unit
  // amount is still what gets sent on-chain).
  return 7
}

export function toBaseUnits(amount: string, decimals: number): bigint {
  const [whole, frac = ""] = amount.split(".")
  const paddedFrac = (frac + "0".repeat(decimals)).slice(0, decimals)
  const combined = `${whole || "0"}${paddedFrac}`
  return BigInt(combined)
}

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

  const prepared = await getServer().prepareTransaction(tx)
  return prepared
}

export type SubmitResult = { status: "SUCCESS"; hash: string } | { status: "FAILED"; hash: string; message: string }

export async function signAndSubmit(tx: Transaction, signerAddress: string): Promise<SubmitResult> {
  const networkCheck = await freighter.getNetworkDetails().catch(() => null)
  if (networkCheck && networkCheck.networkPassphrase && networkCheck.networkPassphrase !== NETWORK_PASSPHRASE) {
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
      if (statusRes.status === "SUCCESS") {
        return { status: "SUCCESS", hash }
      }
      return { status: "FAILED", hash, message: "Transaction failed on-chain." }
    }
  }
  throw new Error("Timed out waiting for transaction confirmation.")
}
