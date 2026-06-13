import { NextRequest, NextResponse } from 'next/server'
import {
  send7710Transaction,
  waitForTask,
  encodeERC20Transfer,
  USDC_BASE,
  ONESHOT_FEE_ADDRESS,
  ONESHOT_FEE_USDC,
  DelegationRecord,
} from '@/lib/oneshot'

const BASE_EXPLORER = 'https://basescan.org/tx/'

// 1Shot permissionless relayer only accepts this address as recipient (demo wallet)
const ONESHOT_DEMO_RECIPIENT = '0xE936e8FAf4A5655469182A49a505055B71C17604'

export async function POST(req: NextRequest) {
  try {
    const {
      taskId,
      from,
      recipients,
      signedDelegation,
    }: {
      taskId: string
      from: string
      recipients: { address: string; amount: string; label?: string }[]
      chainId: number
      signedDelegation?: DelegationRecord
    } = await req.json().catch(() => ({}))

    if (!from || !recipients?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!signedDelegation) {
      return NextResponse.json(
        { error: 'No signed delegation — approve the task first.' },
        { status: 400 }
      )
    }

    // 1Shot requires fee transfer first, then recipient transfers
    // All recipients routed to demo wallet (1Shot permissionless relayer restriction)
    const feeExecution = {
      target: USDC_BASE,
      value: '0',
      data: encodeERC20Transfer(ONESHOT_FEE_ADDRESS, ONESHOT_FEE_USDC),
    }

    const recipientExecutions = recipients.map((r) => {
      const amount = BigInt(Math.floor(parseFloat(r.amount) * 1e6))
      console.log(`[execute] ${r.label ?? r.address} → demo wallet, amount: ${amount}`)
      return {
        target: USDC_BASE,
        value: '0',
        data: encodeERC20Transfer(ONESHOT_DEMO_RECIPIENT, amount),
      }
    })

    const executions = [feeExecution, ...recipientExecutions]

    const relayTaskId = await send7710Transaction(signedDelegation, executions)
    const txHash = await waitForTask(relayTaskId, 60_000)
    const txHashes = recipients.map(() => txHash ?? `pending:${relayTaskId}`)

    return NextResponse.json({
      taskId,
      txHashes,
      isSimulated: recipients.map(() => false),
      explorer: BASE_EXPLORER,
    })
  } catch (err: any) {
    const msg = err?.message ?? String(err) ?? 'Unknown error'
    console.error('[execute] ERROR:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
