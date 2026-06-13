'use client'

import { PaymentTask } from '@/types'
import { encodeERC20Transfer } from '@/lib/oneshot'

// USDC on Base Sepolia testnet
const USDC_BASE = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
const BASE_EXPLORER = 'https://sepolia.basescan.org/tx/'

export async function executeTask(
  task: PaymentTask,
  address: string,
  _chainId: number
): Promise<{ txHashes: string[]; isSimulated: boolean; explorer: string }> {
  if (!window.ethereum) throw new Error('MetaMask not connected')

  // Switch to Base Sepolia for testnet USDC
  const currentChain: string = await window.ethereum.request({ method: 'eth_chainId' })
  if (currentChain !== '0x14a34') {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x14a34' }],
    })
  }

  const txHashes: string[] = []
  for (const recipient of task.recipients) {
    const amount = BigInt(Math.floor(parseFloat(recipient.amount) * 1e6))
    const data = encodeERC20Transfer(recipient.address, amount)
    const txHash: string = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{ from: address, to: USDC_BASE, data }],
    })
    txHashes.push(txHash)
  }

  return { txHashes, isSimulated: false, explorer: BASE_EXPLORER }
}

export function getNextExecution(frequency: PaymentTask['frequency']): string {
  const ms =
    frequency === 'daily'   ? 86400_000 :
    frequency === 'weekly'  ? 604800_000 :
    frequency === 'monthly' ? 2592000_000 : 0
  return new Date(Date.now() + ms).toISOString()
}
