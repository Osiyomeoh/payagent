'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader, AlertCircle, Zap, Sparkles, Trash2 } from 'lucide-react'
import { useAppStore } from '@/store'
import { AgentMessage } from '@/types'
import TaskPlanCard from './TaskPlanCard'
import AgentPipeline from './AgentPipeline'
import { fetchPriceData } from '@/lib/x402client'

const SUGGESTIONS = [
  'Pay 3 contributors 50 USDC weekly for a month',
  'Send 200 USDC to 0xAbc… once',
  'Set up daily 10 USDC drip to my savings wallet',
]

export default function AgentChat() {
  const {
    messages, addMessage, clearMessages, isAgentThinking, setAgentThinking,
    agentStage, setAgentStage,
    veniceApiKey,
    address, isConnected, smartAccountAddress,
  } = useAppStore()

  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isAgentThinking])

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim()
    if (!content || isAgentThinking) return

    const userMsg: AgentMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    }
    addMessage(userMsg)
    setInput('')
    setAgentThinking(true)

    // A2A pipeline stages
    const pipelineStages: Array<typeof agentStage> = ['parse', 'validate']
    for (const stage of pipelineStages) {
      setAgentStage(stage)
      await new Promise((r) => setTimeout(r, 600))
    }

    try {
      // x402 stage — fetch live market prices
      // Tries x402 paid fetch first (requires Base Sepolia), falls back to free CoinGecko
      let priceContext = ''
      setAgentStage('fetch')
      try {
        let prices: { eth: number | null; btc: number | null; paidVia?: string } | null = null

        // Attempt x402 payment — requires Base Sepolia (84532)
        // Switch chain, pay, then switch back to original chain
        if (address && window.ethereum) {
          try {
            const originalChainHex: string = await window.ethereum.request({ method: 'eth_chainId' })
            const isAlreadySepolia = originalChainHex === '0x14a34' // 84532
            if (!isAlreadySepolia) {
              await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x14a34' }],
              }).catch(async (e: any) => {
                // Chain not added — add it
                if (e?.code === 4902) {
                  await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{ chainId: '0x14a34', chainName: 'Base Sepolia', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://sepolia.base.org'], blockExplorerUrls: ['https://sepolia.basescan.org'] }],
                  })
                }
              })
            }
            prices = await fetchPriceData(window.ethereum, address)
            priceContext = `\n[Live market data fetched via x402 — 0.01 USDC paid on Base Sepolia]: ETH=$${prices.eth}, BTC=$${prices.btc}`
            // Switch back to original chain
            if (!isAlreadySepolia) {
              await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: originalChainHex }],
              }).catch(() => {})
            }
          } catch {
            // x402 failed — fall back to free CoinGecko
          }
        }

        // Free fallback: CoinGecko public API
        if (!prices) {
          const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin&vs_currencies=usd')
            .then(res => res.json()).catch(() => null)
          if (r) {
            prices = { eth: r?.ethereum?.usd ?? null, btc: r?.bitcoin?.usd ?? null }
            priceContext = `\n[Live market data]: ETH=$${prices.eth}, BTC=$${prices.btc}`
          }
        }
      } catch {
        // Fully non-fatal — continue without prices
      }

      setAgentStage('plan')
      await new Promise((r) => setTimeout(r, 400))

      const history = [...messages, userMsg].map((m) => ({
        role: m.role === 'agent' ? ('assistant' as const) : ('user' as const),
        content: m.content,
      }))

      // Append live price context to last user message if available
      if (priceContext && history.length > 0) {
        history[history.length - 1].content += priceContext
      }

      const demoMode = !veniceApiKey

      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          veniceKey: veniceApiKey,
          demoMode,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `Agent error ${res.status}`)

      setAgentStage('done')
      await new Promise((r) => setTimeout(r, 300))

      const agentMsg: AgentMessage = {
        id: `a_${Date.now()}`,
        role: 'agent',
        content: data.text || "Here's your payment plan:",
        timestamp: new Date().toISOString(),
        taskPlan: data.taskPlan,
      }
      addMessage(agentMsg)
    } catch (err: any) {
      setAgentStage('')
      addMessage({
        id: `e_${Date.now()}`,
        role: 'agent',
        content: `Error: ${err.message}`,
        timestamp: new Date().toISOString(),
      })
    } finally {
      setAgentThinking(false)
      setAgentStage('')
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const noKeys = !veniceApiKey

  return (
    <div className="chat-container">
      {messages.length > 0 && (
        <div className="chat-header-bar">
          <button className="chat-clear-btn" onClick={clearMessages} title="Clear chat">
            <Trash2 size={13} /> Clear chat
          </button>
        </div>
      )}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-hero">
              <div className="chat-empty-icon"><Bot size={28} /></div>
              <p className="chat-empty-title">PayAgent is ready</p>
              <p className="chat-empty-sub">
                Describe a payment in plain English. I'll plan it, get your approval via MetaMask Smart Account, then execute autonomously — no ETH needed.
              </p>
              {noKeys && (
                <div className="chat-demo-badge">
                  <Sparkles size={12} /> Demo mode — add your Venice AI key in Settings for live AI
                </div>
              )}
              {smartAccountAddress && (
                <div className="chat-sa-active">
                  <div className="chat-sa-dot" />
                  Smart Account active · {smartAccountAddress.slice(0, 8)}…{smartAccountAddress.slice(-6)}
                </div>
              )}
            </div>
            <div className="chat-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chat-suggestion" onClick={() => sendMessage(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`chat-message ${msg.role}`}>
            <div className="chat-avatar">
              {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
            </div>
            <div className="chat-bubble-wrap">
              <div className={`chat-bubble ${msg.role}`}>
                <p>{msg.content}</p>
              </div>
              {msg.taskPlan && <TaskPlanCard plan={msg.taskPlan} />}
            </div>
          </div>
        ))}

        {isAgentThinking && (
          <div className="chat-message agent">
            <div className="chat-avatar"><Bot size={14} /></div>
            <div className="chat-bubble-wrap">
              <AgentPipeline stage={agentStage} />
              {!agentStage && (
                <div className="chat-bubble agent thinking">
                  <span className="dot" /><span className="dot" /><span className="dot" />
                </div>
              )}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-wrap">
        {!isConnected && (
          <div className="chat-warning">
            <AlertCircle size={14} /> Connect your MetaMask wallet to approve and execute tasks
          </div>
        )}
        <div className="chat-input-row">
          <textarea
            className="chat-input"
            rows={2}
            placeholder="Pay 3 contributors 50 USDC weekly for a month…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={isAgentThinking}
          />
          <button
            className="chat-send"
            onClick={() => sendMessage()}
            disabled={!input.trim() || isAgentThinking}
          >
            {isAgentThinking ? <Loader size={16} className="spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  )
}
