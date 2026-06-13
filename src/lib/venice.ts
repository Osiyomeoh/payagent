import { AgentTaskPlan } from '@/types'

// Gemini OpenAI-compatible endpoint
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai'
const GEMINI_MODEL = 'gemini-2.0-flash'

const SYSTEM_PROMPT = `You are PayAgent, an autonomous on-chain payment agent powered by MetaMask Smart Accounts.

Your job is to:
1. Parse natural language payment instructions from users
2. Extract structured task plans (recipients, amounts, frequency, duration)
3. Explain what you plan to do clearly and concisely
4. Ask for clarification only when absolutely necessary

When a user describes a payment task, respond with:
- A brief friendly confirmation of what you understood
- A structured JSON block wrapped in <task_plan>...</task_plan> tags

The task_plan JSON must follow this schema:
{
  "description": "human-readable summary",
  "recipients": [{"address": "0x...", "amount": "50", "label": "Alice"}],
  "totalAmount": "150",
  "tokenSymbol": "USDC",
  "frequency": "once" | "daily" | "weekly" | "monthly",
  "endDate": "ISO date string or null",
  "estimatedGas": "~0.50",
  "requiresPermission": true
}

Always set requiresPermission to true when frequency is not "once".
For ENS names or labels without addresses, use a placeholder like "0x0000...LABEL".
Be friendly, concise, and professional. You are helping users automate Web3 payments.`

export async function callVeniceAgent(
  messages: { role: 'user' | 'assistant'; content: string }[],
  apiKey: string
): Promise<{ text: string; taskPlan?: AgentTaskPlan }> {
  const key = apiKey || process.env.GEMINI_API_KEY || ''
  if (!key) throw new Error('Gemini API key not set. Add it in Settings or set GEMINI_API_KEY in .env.local')

  const response = await fetch(`${GEMINI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: GEMINI_MODEL,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      max_tokens: 1024,
      temperature: 0.3,
    }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body?.error?.message ?? `Gemini API error: ${response.status}`)
  }

  const data = await response.json()
  const text: string = data.choices?.[0]?.message?.content ?? ''

  const taskPlanMatch = text.match(/<task_plan>([\s\S]*?)<\/task_plan>/)
  let taskPlan: AgentTaskPlan | undefined
  if (taskPlanMatch) {
    try { taskPlan = JSON.parse(taskPlanMatch[1].trim()) } catch { /* ignore */ }
  }

  const cleanText = text.replace(/<task_plan>[\s\S]*?<\/task_plan>/g, '').trim()
  return { text: cleanText, taskPlan }
}
