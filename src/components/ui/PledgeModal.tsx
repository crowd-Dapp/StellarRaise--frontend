"use client"

import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useWallet } from "@/context/WalletContext"
import { buildContributeTx, getTokenDecimals, signAndSubmit, toBaseUnits } from "@/lib/soroban"
import type { CampaignSummary } from "@/types/campaign"

interface PledgeModalProps {
  isOpen: boolean
  onClose: () => void
  campaign: CampaignSummary | null
}

type TxState = "idle" | "processing" | "success" | "error"

export function PledgeModal({ isOpen, onClose, campaign }: PledgeModalProps) {
  const { address, connect } = useWallet()
  const [pledgeAmount, setPledgeAmount] = useState<string>("100")
  const [txState, setTxState] = useState<TxState>("idle")
  const [errorMessage, setErrorMessage] = useState<string>("")
  const [txHash, setTxHash] = useState<string>("")

  const handlePledge = async () => {
    if (!campaign) return

    if (!address) {
      await connect()
      return
    }

    if (!pledgeAmount || isNaN(Number(pledgeAmount)) || Number(pledgeAmount) <= 0) {
      setTxState("error")
      setErrorMessage("Please enter a valid amount.")
      return
    }

    setTxState("processing")

    try {
      const decimals = await getTokenDecimals(campaign.token)
      const amountBaseUnits = toBaseUnits(pledgeAmount, decimals)

      const tx = await buildContributeTx(campaign.id, address, amountBaseUnits)
      const result = await signAndSubmit(tx, address)

      if (result.status === "SUCCESS") {
        setTxHash(result.hash)
        setTxState("success")
        setTimeout(() => {
          setTxState("idle")
          onClose()
        }, 4000)
      } else {
        setTxState("error")
        setErrorMessage(result.message)
      }
    } catch (err) {
      setTxState("error")
      const message = err instanceof Error ? err.message : String(err)
      setErrorMessage(message || "Transaction failed or rejected.")
    }
  }

  const handleClose = () => {
    if (txState === "processing") return
    setTxState("idle")
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && campaign && (
        <React.Fragment>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
          />

          {/* Modal content */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-card border border-card-border rounded-2xl shadow-2xl p-6 pointer-events-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-foreground">Backing Project</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClose}
                  disabled={txState === "processing"}
                  className="rounded-full"
                >
                  <X className="w-5 h-5 text-foreground/60" />
                </Button>
              </div>

              {txState === "success" ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", bounce: 0.5 }}
                    className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-4"
                  >
                    <CheckCircle2 className="w-8 h-8" />
                  </motion.div>
                  <h3 className="text-2xl font-bold mb-2">Pledge Successful!</h3>
                  <p className="text-foreground/70">
                    You have successfully pledged to {campaign.title}.
                  </p>
                  {txHash && (
                    <a
                      href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary underline mt-3"
                    >
                      View transaction
                    </a>
                  )}
                </div>
              ) : txState === "error" ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-4"
                  >
                    <AlertCircle className="w-8 h-8" />
                  </motion.div>
                  <h3 className="text-2xl font-bold mb-2">Transaction Failed</h3>
                  <p className="text-foreground/70 mb-6">{errorMessage}</p>
                  <Button variant="outline" onClick={() => setTxState("idle")} className="w-full">
                    Try Again
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <p className="text-sm text-foreground/70">
                    You are pledging to <span className="font-semibold text-foreground">{campaign.title}</span>.
                  </p>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Amount to Pledge</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={pledgeAmount}
                        onChange={(e) => setPledgeAmount(e.target.value)}
                        className="w-full bg-background border border-card-border rounded-xl px-4 py-3 text-lg font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                        placeholder="100"
                        min="1"
                        disabled={txState === "processing"}
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handlePledge}
                    disabled={txState === "processing"}
                    className="w-full h-12 text-lg mt-4 shadow-primary/30"
                  >
                    {txState === "processing" ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Confirming in Wallet...
                      </span>
                    ) : !address ? (
                      "Connect Wallet to Pledge"
                    ) : (
                      "Confirm Pledge"
                    )}
                  </Button>
                </div>
              )}
            </motion.div>
          </div>
        </React.Fragment>
      )}
    </AnimatePresence>
  )
}
