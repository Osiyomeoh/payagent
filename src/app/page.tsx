import Link from 'next/link'
import { Zap, Shield, Bot, ArrowRight, Globe, Lock, Cpu } from 'lucide-react'

export default function Landing() {
  return (
    <div className="land">

      {/* Nav */}
      <nav className="land-nav">
        <div className="land-logo">
          <Zap size={18} className="land-logo-icon" />
          <span>PayAgent</span>
          <span className="land-beta">beta</span>
        </div>
        <Link href="/app" className="land-launch-btn">
          Launch App <ArrowRight size={14} />
        </Link>
      </nav>

      {/* Hero */}
      <section className="land-hero">
        <h1 className="land-title">
          Autonomous<br />
          <span className="land-title-accent">On-Chain Payments</span>
        </h1>
        <p className="land-sub">
          Describe a payment in plain English. PayAgent plans it, gets your approval once, and executes on Base — no per-transaction popups, no ETH needed.
        </p>
        <div className="land-cta-row">
          <Link href="/app" className="land-cta-primary">
            <Zap size={16} /> Open PayAgent
          </Link>
          <a
            href="https://sepolia.basescan.org/tx/0x45c6f03e4567574e2de21985efbb7e06cf40e37b65fc1ed60fa4dffb4f9a7e0b"
            target="_blank"
            rel="noopener noreferrer"
            className="land-cta-secondary"
          >
            <Globe size={14} /> Live tx on BaseScan
          </a>
        </div>
      </section>

      {/* Demo input mockup */}
      <section className="land-demo">
        <div className="land-demo-card">
          <div className="land-demo-top">
            <Bot size={14} className="land-demo-icon" />
            <span>PayAgent</span>
            <span className="land-demo-live"><span className="land-dot green" />live</span>
          </div>
          <div className="land-demo-msg user">
            Pay 3 contributors 50 USDC weekly for a month
          </div>
          <div className="land-demo-msg agent">
            Got it! I'll set up weekly payments of 50 USDC to each of your 3 contributors — 150 USDC per execution. Approve once and I'll handle everything automatically.
          </div>
          <div className="land-demo-pipeline">
            {['Parse', 'Validate', 'x402 Fetch', 'Plan'].map((s, i) => (
              <div key={s} className="land-pipeline-step">
                <div className={`land-pipeline-dot ${i < 4 ? 'done' : ''}`} />
                <span>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="land-features">
        <div className="land-feature">
          <div className="land-feature-icon"><Bot size={20} /></div>
          <h3>Venice AI</h3>
          <p>Privacy-first inference via Llama 3.3 70B. Your payment data never touches a centralized server.</p>
        </div>
        <div className="land-feature">
          <div className="land-feature-icon"><Globe size={20} /></div>
          <h3>x402 Protocol</h3>
          <p>Agent pays 0.01 USDC for live market data automatically. Machine-to-machine micropayments, no human input.</p>
        </div>
        <div className="land-feature">
          <div className="land-feature-icon"><Shield size={20} /></div>
          <h3>MetaMask Smart Accounts</h3>
          <p>ERC-7710 delegation lets the agent execute transfers after a single upfront permission grant.</p>
        </div>
        <div className="land-feature">
          <div className="land-feature-icon"><Cpu size={20} /></div>
          <h3>1Shot Relayer</h3>
          <p>Gasless execution on Base via the 1Shot permissionless relayer. No ETH required for transfers.</p>
        </div>
        <div className="land-feature">
          <div className="land-feature-icon"><Lock size={20} /></div>
          <h3>A2A Pipeline</h3>
          <p>4-stage agent coordination — Parse → Validate → Fetch → Plan. Fully autonomous end-to-end.</p>
        </div>
        <div className="land-feature">
          <div className="land-feature-icon"><Zap size={20} /></div>
          <h3>Real On-Chain</h3>
          <p>Not a simulation. Live USDC transfers on Base Sepolia with transaction hashes on BaseScan.</p>
        </div>
      </section>

      {/* CTA */}
      <section className="land-bottom-cta">
        <h2>Ready to see it in action?</h2>
        <Link href="/app" className="land-cta-primary large">
          <Zap size={18} /> Launch PayAgent
        </Link>
      </section>

      <footer className="land-footer">
        <a href="https://payagent-seven.vercel.app" target="_blank" rel="noopener noreferrer">payagent-seven.vercel.app</a> · Base Sepolia · Venice AI · MetaMask · 1Shot · x402
      </footer>
    </div>
  )
}
