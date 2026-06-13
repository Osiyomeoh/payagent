import { NextRequest, NextResponse } from 'next/server'
import { runAgent } from '@/lib/agent'

export async function POST(req: NextRequest) {
  try {
    const { messages, veniceKey, demoMode } = await req.json()
    const vKey = veniceKey || process.env.VENICE_API_KEY || ''
    const result = await runAgent(messages, '', vKey, demoMode)
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
