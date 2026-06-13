import { AgentTaskPlan } from '@/types'

// ─── System prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are PayAgent, an autonomous on-chain payment agent powered by MetaMask Smart Accounts and the MetaMask Delegation Toolkit.

Your job is to:
1. Parse natural language payment instructions from users
2. Extract structured task plans (recipients, amounts, frequency, duration)
3. Explain what you plan to do clearly and concisely
4. Ask for clarification only when absolutely necessary

When a user describes a payment task, respond with:
- A brief friendly confirmation of what you understood (2-3 sentences max)
- A structured JSON block wrapped in <task_plan>...</task_plan> tags

The task_plan JSON schema:
{
  "description": "human-readable summary",
  "recipients": [{"address": "0x...", "amount": "50", "label": "Alice"}],
  "totalAmount": "150",
  "tokenSymbol": "USDC",
  "frequency": "once" | "daily" | "weekly" | "monthly",
  "endDate": "ISO date string or null",
  "estimatedGas": "~0.02",
  "requiresPermission": true
}

CRITICAL rules:
- totalAmount = sum of all recipients per SINGLE execution (not total across all weeks)
- requiresPermission = true only when frequency is not "once"
- For unknown addresses, use "0x0000000000000000000000000000000000000001" and set label
- Give each recipient a UNIQUE placeholder address (0x01, 0x02, 0x03...)
- estimatedGas is always "~0.02"
- Be brief — 1-2 sentences before the task_plan tag`

// ─── Demo mode (no API key needed) ───────────────────────────────────────────

const DEMO_PATTERNS: Array<{
  test: RegExp
  build: (msg: string) => { text: string; taskPlan: AgentTaskPlan }
}> = [
  {
    test: /contributor|team|member|developer|dev/i,
    build: (msg) => {
      const count = (msg.match(/\d+/g)?.[0]) ? parseInt(msg.match(/\d+/g)![0]) : 3
      const amount = (msg.match(/\$?(\d+)\s*usdc/i)?.[1]) ?? '50'
      const freq = /daily/i.test(msg) ? 'daily' : /monthly/i.test(msg) ? 'monthly' : 'weekly'
      const total = (parseFloat(amount) * count).toString()
      const recipients = Array.from({ length: count }, (_, i) => ({
        address: `0x000000000000000000000000000000000000000${i + 1}`,
        amount,
        label: `Contributor ${i + 1}`,
      }))
      return {
        text: `Got it! I'll set up ${freq} payments of ${amount} USDC to each of your ${count} contributors — ${total} USDC total per execution. MetaMask will ask for a one-time ERC-7715 permission grant, then I'll handle everything automatically from your Smart Account.`,
        taskPlan: {
          description: `Pay ${count} contributors ${amount} USDC ${freq}`,
          recipients,
          totalAmount: total,
          tokenSymbol: 'USDC',
          frequency: freq as any,
          endDate: new Date(Date.now() + 30 * 86400_000).toISOString(),
          estimatedGas: '~0.02',
          requiresPermission: true,
        },
      }
    },
  },
  {
    test: /savings|drip|daily|every day/i,
    build: (msg) => {
      const amount = (msg.match(/\$?(\d+)\s*usdc/i)?.[1]) ?? '10'
      return {
        text: `Perfect! I'll set up a daily drip of ${amount} USDC to your savings wallet. Grant permission once and I'll run it every day automatically — gas is handled by the 1Shot relayer, no ETH needed.`,
        taskPlan: {
          description: `Daily ${amount} USDC drip to savings`,
          recipients: [{ address: '0x0000000000000000000000000000000000000001', amount, label: 'Savings Wallet' }],
          totalAmount: amount,
          tokenSymbol: 'USDC',
          frequency: 'daily',
          endDate: new Date(Date.now() + 90 * 86400_000).toISOString(),
          estimatedGas: '~0.02',
          requiresPermission: true,
        },
      }
    },
  },
  {
    test: /send|transfer|pay.*once|one.?time/i,
    build: (msg) => {
      const amount = (msg.match(/\$?(\d+)\s*usdc/i)?.[1]) ?? '100'
      const address = msg.match(/(0x[a-fA-F0-9]{6,})/)?.[1] ?? '0x0000000000000000000000000000000000000001'
      const label = msg.match(/to\s+([a-zA-Z0-9_.]+(?:\.eth)?)\s/i)?.[1] ?? undefined
      return {
        text: `I'll send ${amount} USDC to ${label ?? address.slice(0, 8) + '…'} right away. This is a one-time transfer — no recurring permission needed.`,
        taskPlan: {
          description: `Send ${amount} USDC to ${label ?? address.slice(0, 10) + '…'}`,
          recipients: [{ address, amount, label }],
          totalAmount: amount,
          tokenSymbol: 'USDC',
          frequency: 'once',
          endDate: null as any,
          estimatedGas: '~0.02',
          requiresPermission: false,
        },
      }
    },
  },
]

function tryDemoMode(userMessage: string): { text: string; taskPlan?: AgentTaskPlan } | null {
  for (const pattern of DEMO_PATTERNS) {
    if (pattern.test.test(userMessage)) {
      return pattern.build(userMessage)
    }
  }
  return null
}

// ─── Venice AI — privacy-first on-device inference ───────────────────────────

async function callVenice(
  messages: { role: 'user' | 'assistant'; content: string }[],
  apiKey: string
): Promise<string> {
  const res = await fetch('https://api.venice.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      max_tokens: 2048,
      temperature: 0.3,
    }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const msg = body?.error?.message ?? `Venice error ${res.status}`
    if (res.status === 402) throw new Error('Venice: insufficient balance — add USD credits at venice.ai')
    throw new Error(msg)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

// ─── Parse LLM response ───────────────────────────────────────────────────────

function parseResponse(raw: string): { text: string; taskPlan?: AgentTaskPlan } {
  const taskPlanMatch = raw.match(/<task_plan>([\s\S]*?)<\/task_plan>/)
  let taskPlan: AgentTaskPlan | undefined
  if (taskPlanMatch) {
    try { taskPlan = JSON.parse(taskPlanMatch[1].trim()) } catch { /* ignore */ }
  }
  const text = raw.replace(/<task_plan>[\s\S]*?<\/task_plan>/g, '').trim()
  return { text, taskPlan }
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function runAgent(
  messages: { role: 'user' | 'assistant'; content: string }[],
  _geminiKey: string,
  veniceKey: string,
  demoMode = false
): Promise<{ text: string; taskPlan?: AgentTaskPlan; provider: string }> {
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''

  // 1. Demo mode — instant, no API needed
  if (demoMode || !veniceKey) {
    const demo = tryDemoMode(lastUserMsg)
    if (demo) return { ...demo, provider: 'demo' }
    return {
      text: "I can help you set up automated payments! Try: 'Pay 3 contributors 50 USDC weekly' or 'Send 100 USDC to 0x123…'",
      provider: 'demo',
    }
  }

  // 2. Venice AI — privacy-first, on-device inference
  try {
    const raw = await callVenice(messages, veniceKey)
    return { ...parseResponse(raw), provider: 'venice' }
  } catch (err: any) {
    console.warn('Venice failed:', err.message)
    throw new Error(`Venice API error: ${err.message}. Make sure your Venice API key is set in Settings.`)
  }
}
