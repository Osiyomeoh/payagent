'use client'

import { useEffect, useState } from 'react'
import { Bot, CheckCircle, Loader, Shield, Zap } from 'lucide-react'

const STAGES = [
  { id: 'parse',    icon: Bot,         label: 'Intent Parser',    desc: 'Understanding your request…'          },
  { id: 'validate', icon: Shield,      label: 'Risk Validator',   desc: 'Checking addresses & amounts…'        },
  { id: 'fetch',    icon: Zap,         label: 'x402 Data Fetch',  desc: 'Paying 0.01 USDC for market data…'    },
  { id: 'plan',     icon: Zap,         label: 'Payment Planner',  desc: 'Building execution plan…'             },
]

interface Props {
  stage: string // 'parse' | 'validate' | 'plan' | 'done' | ''
}

export default function AgentPipeline({ stage }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(!!stage)
  }, [stage])

  if (!visible) return null

  const activeIdx = STAGES.findIndex((s) => s.id === stage)

  return (
    <div className="a2a-pipeline">
      <div className="a2a-label">A2A Agent Pipeline</div>
      <div className="a2a-stages">
        {STAGES.map((s, i) => {
          const done = stage === 'done' || i < activeIdx
          const active = i === activeIdx
          const Icon = s.icon
          return (
            <div key={s.id} className={`a2a-stage ${done ? 'done' : active ? 'active' : 'pending'}`}>
              <div className="a2a-stage-icon">
                {done
                  ? <CheckCircle size={14} />
                  : active
                  ? <Loader size={14} className="spin" />
                  : <Icon size={14} />}
              </div>
              <div className="a2a-stage-body">
                <span className="a2a-stage-name">{s.label}</span>
                {active && <span className="a2a-stage-desc">{s.desc}</span>}
              </div>
              {i < STAGES.length - 1 && <div className={`a2a-connector ${done ? 'done' : ''}`} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
