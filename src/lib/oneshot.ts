/**
 * 1Shot Permissionless Relayer — ERC-7710 delegation flow
 *
 * How it works:
 * 1. User's MetaMask Smart Account (delegator) creates a delegation to 1Shot's
 *    RELAYER CONTRACT (delegate = 0xAFAB4b...) with USDC transfer caveats
 * 2. User signs the delegation using the MetaMask Delegation Toolkit
 * 3. App submits relayer_send7710Transaction with signed delegation + executions
 *    Executions MUST include a 0.01 USDC fee transfer to ONESHOT_FEE_ADDRESS
 * 4. 1Shot executes on Base mainnet — no ETH needed, gas paid in USDC
 *
 * Chain: Base mainnet (8453)
 * Explorer: https://basescan.org
 */

export const ONESHOT_RELAYER = 'https://relayer.1shotapi.com/relayers'

// 1Shot's target wallet — delegate in the delegation AND the fee recipient
// On-chain confirmed: delegate = feeAddress = 0x26a529...
export const ONESHOT_TARGET = '0x26a529124f0bbf9af9d8f9f84a43efe47cf1199a'

// 1Shot fee: 0.01 USDC must be included as the FIRST execution in every batch.
// The relayer validates that a transfer to ONESHOT_FEE_ADDRESS for ONESHOT_FEE_USDC exists.
export const ONESHOT_FEE_ADDRESS = ONESHOT_TARGET
export const ONESHOT_FEE_USDC = BigInt(10_000) // 0.01 USDC (6 decimals)
export const ONESHOT_CHAIN_ID = 8453 // Base mainnet

// USDC on Base mainnet (the only 1Shot-supported chain)
export const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

export const USDC_ADDRESSES: Record<number, string> = {
  1:        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  8453:     '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base mainnet
  84532:    '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia USDC
  42161:    '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  137:      '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  11155111: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Sepolia
}

export const CHAIN_EXPLORER: Record<number, string> = {
  8453:     'https://basescan.org/tx/',
  84532:    'https://sepolia.basescan.org/tx/',
  42161:    'https://arbiscan.io/tx/',
  1:        'https://etherscan.io/tx/',
  11155111: 'https://sepolia.etherscan.io/tx/',
}

async function rpc(method: string, params: object): Promise<any> {
  const body = JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params })
  console.log(`[1Shot] ${method}`, JSON.stringify(params))
  const res = await fetch(ONESHOT_RELAYER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
  const text = await res.text()
  console.log(`[1Shot] response (${res.status}):`, text.slice(0, 500))
  if (!res.ok) throw new Error(`1Shot HTTP ${res.status}: ${text.slice(0, 200)}`)
  let data: any
  try { data = JSON.parse(text) } catch { throw new Error(`1Shot bad JSON: ${text.slice(0, 200)}`) }
  if (data.error) throw new Error(`1Shot: ${JSON.stringify(data.error)}`)
  return data.result
}

export interface DelegatedExecution {
  target: string
  value: string
  data: string
}

export interface DelegationRecord {
  delegate: string
  delegator: string
  authority: string
  caveats: { enforcer: string; terms: string; args: string }[]
  salt: string
  signature: string
}

/**
 * Submit an ERC-7710 delegation transaction via 1Shot.
 * Accepts a single delegation or a delegation chain (for redelegation).
 * Chain order: [rootDelegation, ...redelegations] — root is user SA → PayAgent,
 * redelegation is PayAgent → 1Shot (A2A coordination pattern).
 */
export async function send7710Transaction(
  delegation: DelegationRecord | DelegationRecord[],
  executions: DelegatedExecution[]
): Promise<string> {
  const permissionContext = Array.isArray(delegation) ? delegation : [delegation]
  const taskId = await rpc('relayer_send7710Transaction', {
    chainId: String(ONESHOT_CHAIN_ID),
    transactions: [{ permissionContext, executions }],
  })
  return String(taskId)
}

/**
 * Estimate a 7710 transaction — validates the delegation before submitting.
 */
export async function estimate7710Transaction(
  delegation: DelegationRecord,
  executions: DelegatedExecution[]
): Promise<{ success: boolean; error?: string }> {
  const result = await rpc('relayer_estimate7710Transaction', {
    chainId: String(ONESHOT_CHAIN_ID),
    transactions: [{ permissionContext: [delegation], executions }],
  })
  return result
}

/**
 * Poll task status until confirmed or failed.
 */
export async function getTaskStatus(taskId: string): Promise<{
  status: string
  txHash?: string
}> {
  const result = await rpc('relayer_getStatus', { id: taskId, logs: false })
  return {
    status: result?.status ?? 'pending',
    txHash: result?.receipt?.transactionHash,
  }
}

/**
 * Wait for a task to confirm, returning the tx hash.
 */
export async function waitForTask(taskId: string, maxMs = 30_000): Promise<string | null> {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2500))
    try {
      const s = await getTaskStatus(taskId)
      if (s.txHash) return s.txHash
      if (s.status === 'failed' || s.status === 'rejected' || s.status === 'reverted') return null
    } catch { /* keep polling */ }
  }
  return null
}

/**
 * Encode ERC-20 transfer(address,uint256) calldata.
 */
export function encodeERC20Transfer(to: string, amount: bigint): string {
  const selector = 'a9059cbb'
  const paddedTo = to.replace('0x', '').padStart(64, '0')
  const paddedAmount = amount.toString(16).padStart(64, '0')
  return `0x${selector}${paddedTo}${paddedAmount}`
}
