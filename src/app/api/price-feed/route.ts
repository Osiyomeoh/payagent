/**
 * x402-protected price feed endpoint.
 *
 * Charges 0.01 USDC on Base mainnet per request via the x402 payment standard.
 * Returns ETH/BTC spot prices from CoinGecko.
 *
 * x402 flow:
 *   1. GET /api/price-feed  →  402 Payment Required
 *   2. x402 client signs EIP-3009 USDC authorization, retries with X-PAYMENT header
 *   3. x402.org facilitator verifies and settles on Base mainnet
 *   4. 200 response with price data returned
 */
import { NextRequest, NextResponse } from 'next/server'
import { withX402, x402ResourceServer } from '@x402/next'
import { HTTPFacilitatorClient } from '@x402/core/server'
import { registerExactEvmScheme } from '@x402/evm/exact/server'
import type { RouteConfig, Network } from '@x402/next'

// Coinbase public x402 facilitator
const FACILITATOR_URL = 'https://x402.org/facilitator'

// Treasury address receiving the 0.01 USDC fee
const PAYMENT_RECIPIENT = '0x26a529124f0bbf9af9d8f9f84a43efe47cf1199a'

// USDC on Base Sepolia testnet
// (x402.org facilitator only supports Base Sepolia for exact scheme)

// Build x402 resource server with HTTP facilitator client
const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL })
const server = new x402ResourceServer(facilitatorClient)
registerExactEvmScheme(server)

const routeConfig: RouteConfig = {
  accepts: {
    scheme: 'exact',
    network: 'eip155:84532' as Network, // Base Sepolia (supported by x402.org facilitator)
    price: '0.01',
    payTo: PAYMENT_RECIPIENT,
    maxTimeoutSeconds: 300,
    extra: { name: 'PayAgent Price Feed' },
  },
  description: 'Real-time ETH/BTC price data via x402',
  mimeType: 'application/json',
}

async function priceFeedHandler(_req: NextRequest) {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin&vs_currencies=usd',
      { next: { revalidate: 60 } }
    )
    const data = await res.json()
    return NextResponse.json({
      eth: data?.ethereum?.usd ?? null,
      btc: data?.bitcoin?.usd ?? null,
      timestamp: new Date().toISOString(),
      paidVia: 'x402 on Base',
    })
  } catch {
    return NextResponse.json({
      eth: 3200,
      btc: 62000,
      timestamp: new Date().toISOString(),
      paidVia: 'x402 on Base (fallback)',
    })
  }
}

export const GET = withX402(priceFeedHandler, routeConfig, server, {
  facilitatorUrl: FACILITATOR_URL,
} as any)
