import { NextRequest, NextResponse } from 'next/server'
import { getTaskStatus } from '@/lib/oneshot'

export async function GET(req: NextRequest) {
  const taskId = req.nextUrl.searchParams.get('id')
  if (!taskId) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  try {
    const status = await getTaskStatus(taskId)
    return NextResponse.json(status)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
