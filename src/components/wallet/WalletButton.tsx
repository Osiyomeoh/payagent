'use client'

import { useState, useEffect } from 'react'
import { Wallet, LogOut, ChevronDown, Zap, Shield, Loader, CheckCircle, ExternalLink } from 'lucide-react'
import { useAppStore } from '@/store'
import { getSmartAccountInfo } from '@/lib/smartAccount'

declare global {
  interface Window { ethereum?: any }
}

export default function WalletButton() {
  const {
    address, isConnected,
    setWallet, disconnectWallet,
    smartAccountAddress, smartAccountDeployed,
    setSmartAccount, clearSmartAccount,
  } = useAppStore()

  const [isOpen, setIsOpen] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [activating, setActivating] = useState(false)
  const [activateError, setActivateError] = useState('')

  async function connect() {
    if (!window.ethereum) {
      alert('Please install MetaMask to use PayAgent')
      return
    }
    setConnecting(true)
    try {
      // wallet_requestPermissions forces MetaMask to open the account picker every time
      // eth_requestAccounts alone silently reuses the cached/last account
      await window.ethereum.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }],
      })
      const accounts: string[] = await window.ethereum.request({ method: 'eth_requestAccounts' })
      const chainIdHex: string = await window.ethereum.request({ method: 'eth_chainId' })
      setWallet(accounts[0], parseInt(chainIdHex, 16))
    } catch (e) {
      console.error(e)
    } finally {
      setConnecting(false)
    }
  }

  async function activateSmartAccount() {
    if (!address || !window.ethereum) return
    setActivating(true)
    setActivateError('')
    try {
      const info = await getSmartAccountInfo(window.ethereum, address)
      setSmartAccount(info.address, info.isDeployed)
    } catch (err: any) {
      console.error('Smart account activation failed:', err)
      setActivateError(err.message ?? 'Failed to activate smart account')
    } finally {
      setActivating(false)
    }
  }

  // Auto-derive smart account when wallet connects
  useEffect(() => {
    if (isConnected && address && !smartAccountAddress && window.ethereum) {
      activateSmartAccount()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address])

  useEffect(() => {
    if (!window.ethereum) return
    const handler = (accounts: string[]) => {
      if (accounts.length === 0) { disconnectWallet(); clearSmartAccount() }
    }
    window.ethereum.on('accountsChanged', handler)
    return () => window.ethereum.removeListener('accountsChanged', handler)
  }, [disconnectWallet, clearSmartAccount])

  const shortEOA = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : ''

  if (!isConnected) {
    return (
      <button onClick={connect} disabled={connecting} className="wallet-btn connect">
        <Wallet size={15} />
        {connecting ? 'Connecting…' : 'Connect MetaMask'}
      </button>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        className={`wallet-btn connected ${smartAccountAddress ? 'smart' : ''}`}
        onClick={() => setIsOpen((v) => !v)}
      >
        {smartAccountAddress
          ? <Shield size={13} className="wallet-sa-icon" />
          : <span className="wallet-dot" />}
        {shortEOA}
        {smartAccountAddress && <span className="wallet-sa-badge">SA</span>}
        <ChevronDown size={13} />
      </button>

      {isOpen && (
        <div className="wallet-dropdown">
          <div className="wallet-dropdown-section">
            <span className="wallet-dropdown-label">EOA Wallet</span>
            <div className="wallet-dropdown-addr">{address}</div>
          </div>

          <div className="wallet-dropdown-section">
            <span className="wallet-dropdown-label">
              MetaMask Smart Account
              <span className="wallet-sa-tag">ERC-7715</span>
            </span>
            {smartAccountAddress ? (
              <div className="wallet-sa-info">
                <CheckCircle size={12} style={{ color: 'var(--green)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="wallet-dropdown-addr">{smartAccountAddress}</div>
                  <div className="wallet-sa-status">
                    {smartAccountDeployed
                      ? '✓ Deployed on Sepolia'
                      : '⏳ Counterfactual — deploys on first tx'}
                  </div>
                </div>
                <a
                  href={`https://sepolia.etherscan.io/address/${smartAccountAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wallet-etherscan-link"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink size={11} />
                </a>
              </div>
            ) : activating ? (
              <div className="wallet-sa-loading">
                <Loader size={12} className="spin" /> Deriving smart account…
              </div>
            ) : (
              <button className="wallet-activate-btn" onClick={activateSmartAccount}>
                <Zap size={12} /> Activate Smart Account
              </button>
            )}
            {activateError && <p className="wallet-sa-error">{activateError}</p>}
          </div>

          <button
            className="wallet-dropdown-item disconnect"
            onClick={() => { disconnectWallet(); clearSmartAccount(); setIsOpen(false) }}
          >
            <LogOut size={13} /> Disconnect
          </button>
        </div>
      )}
    </div>
  )
}
