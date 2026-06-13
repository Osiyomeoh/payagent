'use client'

import { useState } from 'react'
import { CheckCircle, Clock, Users, Zap, Loader, Shield, AlertTriangle } from 'lucide-react'
import { AgentTaskPlan, PaymentTask } from '@/types'
import { useAppStore } from '@/store'

interface Props { plan: AgentTaskPlan }

export default function TaskPlanCard({ plan }: Props) {
  const { address, addTask } = useAppStore()
  const [status, setStatus] = useState<'idle' | 'approving' | 'approved' | 'error'>('idle')
  const [error, setError] = useState('')

  async function approve() {
    if (!address) return
    setStatus('approving')
    setError('')
    try {
      const task: PaymentTask = {
        id: `task_${Date.now()}`,
        createdAt: new Date().toISOString(),
        description: plan.description,
        recipients: plan.recipients,
        totalAmount: plan.totalAmount,
        tokenSymbol: plan.tokenSymbol,
        frequency: plan.frequency,
        nextExecution: new Date(Date.now() + 86400_000).toISOString(),
        endDate: plan.endDate ?? undefined,
        status: 'approved',
        txHashes: [],
      }
      addTask(task)
      setStatus('approved')
    } catch (err: any) {
      setError(err.message ?? 'Approval failed')
      setStatus('error')
    }
  }

  return (
    <div className="task-plan-card">
      <div className="task-plan-header">
        <Zap size={14} />
        <span>Task plan</span>
        <span className="task-plan-sa-badge"><Shield size={10} /> MetaMask</span>
      </div>

      <p className="task-plan-desc">{plan.description}</p>

      <div className="task-plan-grid">
        <div className="task-plan-stat"><Users size={12} /><span>{plan.recipients.length} recipient{plan.recipients.length !== 1 ? 's' : ''}</span></div>
        <div className="task-plan-stat"><span className="task-plan-amount">{plan.totalAmount} {plan.tokenSymbol}</span><span>per execution</span></div>
        <div className="task-plan-stat"><Clock size={12} /><span>{plan.frequency}</span></div>
        <div className="task-plan-stat"><Shield size={12} /><span>~{plan.estimatedGas} gas</span></div>
      </div>

      <div className="task-plan-recipients">
        {plan.recipients.map((r, i) => (
          <div key={i} className="task-plan-recipient">
            <span className="task-plan-addr">{r.label ?? `${r.address.slice(0, 8)}…`}</span>
            <span className="task-plan-recv-amt">{r.amount} {plan.tokenSymbol}</span>
          </div>
        ))}
      </div>

      {!address && (
        <div className="task-plan-permission-note" style={{ borderColor: 'var(--amber)', color: 'var(--amber)' }}>
          <AlertTriangle size={12} /><span>Connect your wallet to approve this task.</span>
        </div>
      )}

      {error && (
        <div className="task-plan-permission-note" style={{ borderColor: 'var(--red,#f87171)', color: 'var(--red,#f87171)' }}>
          <AlertTriangle size={12} /><span>{error}</span>
        </div>
      )}

      {status === 'approved' ? (
        <div className="task-plan-success"><CheckCircle size={15} />Task queued — go to Tasks tab and click Run now</div>
      ) : (
        <button className="task-plan-approve" onClick={approve} disabled={status === 'approving' || !address}>
          {status === 'approving' ? <><Loader size={14} className="spin" /> Queuing…</> : <><Shield size={14} />Approve Task</>}
        </button>
      )}
    </div>
  )
}
