'use client'

/**
 * x402 client for PayAgent.
 *
 * Wraps fetch so the AI agent can call x402-protected APIs and pay automatically
 * using the user's MetaMask wallet (EIP-3009 USDC authorization on Base mainnet).
 *
 * Usage:
 *   const fetch402 = createX402Fetch(window.ethereum, ownerAddress)
 *   const data = await fetch402('/api/price-feed').then(r => r.json())
 *   // Automatically: 402 detected → signs USDC authorization → retries → 200
 */

import { createWalletClient, createPublicClient, custom, http } from 'viem'
import { baseSepolia } from 'viem/chains'
import { wrapFetchWithPaymentFromConfig } from '@x402/fetch'
import { ExactEvmScheme } from '@x402/evm'
import { toClientEvmSigner } from '@x402/evm'
import type { Network } from '@x402/fetch'

// x402.org facilitator supports Base Sepolia (eip155:84532) for exact EVM scheme
const BASE_SEPOLIA_RPC = 'https://sepolia.base.org'

/**
 * Creates a payment-enabled fetch for the given MetaMask provider.
 * The user must be on Base Sepolia for the x402 payment to succeed.
 * If they're on a different chain, the fetch will throw and the caller should handle it.
 */
export function createX402Fetch(provider: any, ownerAddress: string) {
  // Use Base Sepolia for x402 — that's what x402.org facilitator supports
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(BASE_SEPOLIA_RPC) })
  const walletClient = createWalletClient({
    chain: baseSepolia,
    account: ownerAddress as `0x${string}`,
    transport: custom(provider),
  })

  // Build EVM signer: needs signTypedData + readContract
  const signer = toClientEvmSigner({
    address: ownerAddress as `0x${string}`,
    signTypedData: (args: any) => walletClient.signTypedData(args),
    readContract: (args: any) => publicClient.readContract(args),
  } as any)

  const exactScheme = new ExactEvmScheme(signer)

  return wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [
      { network: 'eip155:84532' as Network, client: exactScheme }, // Base Sepolia CAIP-2
      { network: 'eip155:*' as Network,     client: exactScheme }, // EVM wildcard fallback
    ],
  })
}

/**
 * Fetch ETH/BTC prices via the x402-protected price feed.
 * Costs 0.01 USDC, paid automatically from the user's Base wallet.
 */
export async function fetchPriceData(
  provider: any,
  ownerAddress: string,
  baseUrl = ''
): Promise<{ eth: number | null; btc: number | null; paidVia: string }> {
  const fetch402 = createX402Fetch(provider, ownerAddress)
  const res = await fetch402(`${baseUrl}/api/price-feed`)
  if (!res.ok) throw new Error(`Price feed error: ${res.status}`)
  return res.json()
}
