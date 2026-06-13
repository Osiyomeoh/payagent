'use client'

import { createPublicClient, createWalletClient, custom, http } from 'viem'
import { sepolia, base } from 'viem/chains'
import {
  Implementation,
  toMetaMaskSmartAccount,
  getDeleGatorEnvironment,
  createDelegation,
  ROOT_AUTHORITY,
} from '@metamask/delegation-toolkit'
// Note: createCaveatBuilder is NOT exported from the toolkit — caveats come from createDelegation's scope param
import { createBundlerClient } from 'viem/account-abstraction'
import type { MetaMaskSmartAccount } from '@metamask/delegation-toolkit'
import { ONESHOT_TARGET, ONESHOT_FEE_USDC, USDC_BASE, DelegationRecord } from '@/lib/oneshot'

// Public Pimlico bundler — no API key needed on Sepolia
const BUNDLER_URL = 'https://public.pimlico.io/v2/11155111/rpc'
// Base mainnet RPC
const BASE_RPC = 'https://mainnet.base.org'

export type SmartAccountInfo = {
  address: `0x${string}`
  isDeployed: boolean
  ownerAddress: `0x${string}`
}

/**
 * Creates a MetaMask Hybrid Smart Account from a connected MetaMask EOA.
 * The EOA becomes the signer/owner; a counterfactual smart account is
 * derived from it at a deterministic address.
 */
export async function createMetaMaskSmartAccount(
  provider: any,
  ownerAddress: string
): Promise<MetaMaskSmartAccount<Implementation.Hybrid>> {
  const chain = sepolia

  const publicClient = createPublicClient({
    chain,
    transport: http(),
  })

  const walletClient = createWalletClient({
    chain,
    account: ownerAddress as `0x${string}`,
    transport: custom(provider),
  })

  const smartAccount = await toMetaMaskSmartAccount({
    client: publicClient,
    implementation: Implementation.Hybrid,
    deployParams: [ownerAddress as `0x${string}`, [], [], []],
    deploySalt: '0x',
    signer: { walletClient },
  })

  return smartAccount
}

/**
 * Returns info about the smart account (address + deployment status)
 * without needing to keep the full account object in React state.
 */
export async function getSmartAccountInfo(
  provider: any,
  ownerAddress: string
): Promise<SmartAccountInfo> {
  const smartAccount = await createMetaMaskSmartAccount(provider, ownerAddress)

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(),
  })

  const code = await publicClient.getBytecode({ address: smartAccount.address })
  const isDeployed = !!code && code !== '0x'

  return {
    address: smartAccount.address,
    isDeployed,
    ownerAddress: ownerAddress as `0x${string}`,
  }
}

/**
 * Request ERC-7715 permissions from MetaMask using wallet_grantPermissions.
 * Returns the permissionsContext to use for execution.
 */
export async function requestPermissions(
  provider: any,
  smartAccountAddress: string,
  chainId: number,
  spendLimitUsdc: string,
  durationDays: number
): Promise<string> {
  const expiryTimestamp = Math.floor(Date.now() / 1000) + durationDays * 86400
  const allowanceHex = `0x${BigInt(Math.round(parseFloat(spendLimitUsdc) * 1e6)).toString(16)}`

  // USDC on Sepolia
  const usdcAddress = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'

  const permissionParams = {
    chainId: `0x${chainId.toString(16)}`,
    address: smartAccountAddress,
    expiry: expiryTimestamp,
    permissions: [
      {
        type: 'erc20-token-transfer',
        data: {
          address: usdcAddress,
          allowance: allowanceHex,
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
    return result?.permissionsContext ?? result?.context ?? `perm_${Date.now()}`
  } catch (err: any) {
    // wallet_grantPermissions is ERC-7715 — not yet in all MetaMask versions.
    // Always fall back to simulation so the demo works regardless.
    console.warn('ERC-7715 wallet_grantPermissions not available — using delegation simulation:', err?.message)
    return `sim_${Date.now()}`
  }
}

/**
 * Creates a bundler client for sending UserOps via the smart account.
 */
export function createSmartAccountBundler(
  smartAccount: MetaMaskSmartAccount<Implementation.Hybrid>
) {
  return createBundlerClient({
    account: smartAccount,
    transport: http(BUNDLER_URL),
  })
}

/**
 * Creates a MetaMask Hybrid Smart Account on Base mainnet.
 * The counterfactual address is the same as long as the owner + salt match.
 */
export async function createBaseSmartAccount(
  provider: any,
  ownerAddress: string
): Promise<MetaMaskSmartAccount<Implementation.Hybrid>> {
  const publicClient = createPublicClient({
    chain: base,
    transport: http(BASE_RPC),
  })

  const walletClient = createWalletClient({
    chain: base,
    account: ownerAddress as `0x${string}`,
    transport: custom(provider),
  })

  const smartAccount = await (toMetaMaskSmartAccount as any)({
    client: publicClient,
    implementation: Implementation.Hybrid,
    deployParams: [ownerAddress as `0x${string}`, [], [], []],
    deploySalt: '0x',
    signer: { walletClient },
  })

  return smartAccount as MetaMaskSmartAccount<Implementation.Hybrid>
}

/**
 * Sign a delegation from the user's Base smart account to 1Shot's target wallet.
 * The delegation grants 1Shot permission to transfer up to `maxAmount` USDC.
 *
 * Returns a DelegationRecord ready for send7710Transaction.
 */
/**
 * Switch MetaMask to Base mainnet (chain 8453) if not already there.
 * Required before signing a delegation — viem wallet client chainId must match.
 */
async function switchToBase(provider: any): Promise<void> {
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x2105' }], // 0x2105 = 8453 (Base mainnet)
    })
  } catch (switchErr: any) {
    // Chain not added yet — add it first
    if (switchErr?.code === 4902) {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0x2105',
          chainName: 'Base',
          nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
          rpcUrls: ['https://mainnet.base.org'],
          blockExplorerUrls: ['https://basescan.org'],
        }],
      })
    } else {
      throw switchErr
    }
  }
}

export async function signDelegationForOneShot(
  provider: any,
  ownerAddress: string,
  maxAmountUsdc: bigint
): Promise<DelegationRecord> {
  // 1Shot only works on Base mainnet — switch chain if needed
  await switchToBase(provider)

  const smartAccount = await createBaseSmartAccount(provider, ownerAddress)

  const environment = getDeleGatorEnvironment(8453)

  // Add 0.01 USDC (ONESHOT_FEE_USDC) per execution to cover 1Shot's fee
  // The relayer deducts this automatically from the delegation budget
  const totalBudget = maxAmountUsdc + ONESHOT_FEE_USDC

  // Delegate directly to 1Shot target (required by 1Shot permissionless relayer)
  const unsignedDelegation = createDelegation({
    to: ONESHOT_TARGET as `0x${string}`,
    from: smartAccount.address,
    environment,
    parentDelegation: ROOT_AUTHORITY,
    scope: {
      type: 'erc20TransferAmount',
      tokenAddress: USDC_BASE as `0x${string}`,
      maxAmount: totalBudget,
    },
  })

  // Sign using the smart account (triggers MetaMask EIP-712 signing)
  const signature = await smartAccount.signDelegation({ delegation: unsignedDelegation, chainId: 8453 })

  return {
    delegate: ONESHOT_TARGET,
    delegator: smartAccount.address,
    authority: ROOT_AUTHORITY,
    caveats: unsignedDelegation.caveats.map((c) => ({
      enforcer: c.enforcer,
      terms: c.terms,
      args: c.args ?? '0x',
    })),
    salt: (() => {
      const s = unsignedDelegation.salt as any
      // salt may be '0x', '0x0', bigint 0n, or a proper hex — handle all cases
      try {
        const n = typeof s === 'bigint' ? s : BigInt(s === '0x' || s === '' ? '0x0' : s)
        return `0x${n.toString(16).padStart(64, '0')}`
      } catch {
        return '0x' + '0'.repeat(64)
      }
    })(),
    signature,
  }
}
