import { NextRequest, NextResponse } from 'next/server'
import { encodeERC20Transfer, USDC_ADDRESSES } from '@/lib/oneshot'

// This legacy endpoint is superseded by /api/execute which uses ERC-7710 delegation.
// Kept as a no-op fallback for backward compatibility.
export async function POST(req: NextRequest) {
  return NextResponse.json({ error: 'Use /api/execute with a signed delegation for 1Shot relay' }, { status: 400 })
}
