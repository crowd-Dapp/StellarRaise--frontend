"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Wallet, Rocket, LogOut, Loader2 } from "lucide-react"
import { useWallet } from "@/context/WalletContext"

export function Navbar() {
  const { address, connect, disconnect, isConnecting, error } = useWallet()

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-card-border bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xl font-bold text-foreground">
          <div className="bg-primary/20 p-2 rounded-xl text-primary">
            <Rocket className="w-5 h-5" />
          </div>
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
            Stellar Raise
          </span>
        </div>
        <div className="flex items-center gap-4">
          {error && <span className="text-red-400 text-sm hidden sm:block">{error}</span>}
          {address ? (
            <div className="flex items-center gap-2">
              <Button variant="secondary" className="gap-2 font-mono hidden sm:flex">
                <Wallet className="w-4 h-4" />
                {`${address.substring(0, 5)}...${address.substring(address.length - 4)}`}
              </Button>
              <Button variant="ghost" size="icon" onClick={disconnect} title="Disconnect">
                <LogOut className="w-4 h-4 text-foreground/60" />
              </Button>
            </div>
          ) : (
            <Button onClick={connect} disabled={isConnecting} className="gap-2 shadow-primary/30">
              {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
              Connect Wallet
            </Button>
          )}
        </div>
      </div>
    </nav>
  )
}
