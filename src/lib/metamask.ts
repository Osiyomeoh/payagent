'use client'

import { PermissionSession } from '@/types'

// ERC-7715 permission request
export interface PermissionRequest {
  chainId: number
  address: string
  spendLimit: string   // in USDC (human readable)
  tokenAddress: string
  durationDays: number
}

export async function requestERC7715Permission(
  req: PermissionRequest,
  provider: any
): Promise<PermissionSession> {
  const expiryTimestamp = Math.floor(Date.now() / 1000) + req.durationDays * 86400
  const spendLimitWei = BigInt(Math.floor(parseFloat(req.spendLimit) * 1e6)).toString(16)

  // ERC-7715 wallet_grantPermissions request
  const permissionParams = {
    chainId: `0x${req.chainId.toString(16)}`,
    address: req.address,
    expiry: expiryTimestamp,
    permissions: [
      {
        type: 'erc20-token-transfer',
        data: {
          address: req.tokenAddress,
          allowance: `0x${spendLimitWei}`,
        },
        policies: [],
        required: true,
      },
    ],
  }

  try {
    const result = await provider.request({
      method: 'wallet_grantPermissions',
      params: [permissionParams],
    })

    return {
      id: result?.permissionsContext ?? `perm_${Date.now()}`,
      grantedAt: new Date().toISOString(),
      expiresAt: new Date(expiryTimestamp * 1000).toISOString(),
      spendLimit: req.spendLimit,
      tokenSymbol: 'USDC',
      address: req.address,
    }
  } catch (err: any) {
    // Fallback for demo/testnet — simulate permission grant
    if (err?.code === 4200 || err?.message?.includes('not supported')) {
      console.warn('ERC-7715 not supported by this wallet, using simulation mode')
      return {
        id: `sim_perm_${Date.now()}`,
        grantedAt: new Date().toISOString(),
        expiresAt: new Date(expiryTimestamp * 1000).toISOString(),
        spendLimit: req.spendLimit,
        tokenSymbol: 'USDC',
        address: req.address,
      }
    }
    throw err
  }
}

// Check if MetaMask Smart Accounts Kit is available
export async function detectSmartAccountSupport(provider: any): Promise<boolean> {
  try {
    const capabilities = await provider.request({
      method: 'wallet_getCapabilities',
      params: [],
    })
    return !!capabilities?.permissions?.supported
  } catch {
    return false
  }
}

// Upgrade EOA to Smart Account via EIP-7702
export async function upgradeToSmartAccount(address: string, provider: any): Promise<boolean> {
  try {
    await provider.request({
      method: 'wallet_upgradeAccount',
      params: [{ address }],
    })
    return true
  } catch {
    return false
  }
}
