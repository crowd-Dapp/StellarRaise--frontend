"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import freighter from "@stellar/freighter-api"

interface WalletContextType {
  address: string | null
  isConnecting: boolean
  error: string | null
  connect: () => Promise<void>
  disconnect: () => void
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const connected = await freighter.isConnected()
        if (connected) {
          const isAllowed = await freighter.isAllowed()
          if (isAllowed) {
            const pubKey = await freighter.getAddress()
            if (pubKey && pubKey.address) {
              setAddress(pubKey.address)
            }
          }
        }
      } catch (err) {
        console.error("Error checking Freighter connection", err)
      }
    }
    checkConnection()
  }, [])

  const connect = async () => {
    setIsConnecting(true)
    setError(null)
    try {
      const connected = await freighter.isConnected()
      if (!connected) {
        throw new Error("Freighter is not installed or not available.")
      }
      
      const access = await freighter.requestAccess()
      if (access) {
        const pubKey = await freighter.getAddress()
        if (pubKey.address) {
          setAddress(pubKey.address)
        } else if (pubKey.error) {
          throw new Error(pubKey.error)
        }
      } else {
        throw new Error("User denied access.")
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage || "Failed to connect to Freighter")
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnect = () => {
    setAddress(null)
  }

  return (
    <WalletContext.Provider value={{ address, isConnecting, error, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  )
}

export const useWallet = () => {
  const context = useContext(WalletContext)
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider")
  }
  return context
}
