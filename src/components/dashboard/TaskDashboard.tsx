'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, Clock, Loader, XCircle, ExternalLink, Zap, Shield, Play, AlertTriangle, RefreshCw, Trash2 } from 'lucide-react'
import { useAppStore } from '@/store'
import { PaymentTask, TaskStatus } from '@/types'
import { format, formatDistanceToNow } from 'date-fns'
import { executeTask } from '@/lib/executor'

const statusConfig: Record<TaskStatus, { icon: any; label: string; cls: string }> = {
  pending:   { icon: Clock,        label: 'Pending',   cls: 'status-pending' },
  approved:  { icon: Shield,       label: 'Approved',  cls: 'status-approved' },
  executing: { icon: Loader,       label: 'Executing', cls: 'status-executing' },
  completed: { icon: CheckCircle,  label: 'Completed', cls: 'status-completed' },
  failed:    { icon: XCircle,      label: 'Failed',    cls: 'status-failed' },
}

export default function TaskDashboard() {
  const { tasks, permissionSession, address, clearTasks } = useAppStore()

  if (tasks.length === 0) {
    return (
      <div className="dashboard-empty">
        <Zap size={24} />
        <p>No tasks yet</p>
        <span>Ask the agent to set up a payment</span>
      </div>
    )
  }

  return (
    <div className="dashboard">
      {permissionSession && (
        <div className="permission-banner">
          <Shield size={14} />
          <div>
            <strong>Permission active</strong>
            <span>Up to {permissionSession.spendLimit} {permissionSession.tokenSymbol} · expires {format(new Date(permissionSession.expiresAt), 'MMM d, yyyy')}</span>
          </div>
        </div>
      )}

      <div className="dashboard-header-bar">
        <button className="chat-clear-btn" onClick={clearTasks}>
          <Trash2 size={13} /> Clear all tasks
        </button>
      </div>

      <div className="task-list">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  )
}

function TaskCard({ task }: { task: PaymentTask }) {
  const { address, chainId, updateTask } = useAppStore()
  const cfg = statusConfig[task.status]
  const Icon = cfg.icon
  const [running, setRunning] = useState(false)
  const [execError, setExecError] = useState('')
  const [, tick] = useState(0)

  // tick every second to refresh the countdown
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // Poll 1Shot for pending tx hashes until confirmed
  useEffect(() => {
    const pendingHashes = task.txHashes.filter(h => h.startsWith('pending:'))
    if (!pendingHashes.length) return
    const interval = setInterval(async () => {
      try {
        for (const h of pendingHashes) {
          const relayId = h.replace('pending:', '')
          const res = await fetch(`/api/task-status?id=${relayId}`)
          if (!res.ok) continue
          const data = await res.json()
          if (data.txHash) {
            const newHashes = task.txHashes.map(x => x === h ? data.txHash : x)
            updateTask(task.id, { txHashes: newHashes, status: 'completed' })
          }
        }
      } catch {}
    }, 4000)
    return () => clearInterval(interval)
  }, [task.txHashes, task.id, updateTask])

  const isDue =
    task.status === 'approved' &&
    task.nextExecution &&
    new Date(task.nextExecution).getTime() <= Date.now()

  async function runNow() {
    if (!address || !chainId || running) return
    setRunning(true)
    setExecError('')
    updateTask(task.id, { status: 'executing' })
    try {
      const { txHashes, isSimulated, explorer } = await executeTask(task, address, chainId)
      const isRecurring = task.frequency !== 'once'
      const nextMs =
        task.frequency === 'daily'   ? 86400_000 :
        task.frequency === 'weekly'  ? 604800_000 :
        task.frequency === 'monthly' ? 2592000_000 : 0
      updateTask(task.id, {
        status: isRecurring ? 'approved' : 'completed',
        txHashes: [...task.txHashes, ...txHashes],
        txSimulated: isSimulated,
        txExplorer: explorer,
        nextExecution: isRecurring ? new Date(Date.now() + nextMs).toISOString() : undefined,
      })
    } catch (err: any) {
      const msg = err?.message ?? 'Execution failed'
      setExecError(msg)
      updateTask(task.id, { status: 'failed' })
      console.error('Execute failed:', msg)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="task-card">
      <div className="task-card-header">
        <div className="task-card-title-row">
          <p className="task-card-title">{task.description}</p>
          <span className={`task-status-badge ${cfg.cls}`}>
            <Icon size={11} className={task.status === 'executing' ? 'spin' : ''} />
            {cfg.label}
          </span>
        </div>
        <div className="task-card-meta">
          <span>{task.totalAmount} {task.tokenSymbol}</span>
          <span className="dot-sep">·</span>
          <span>{task.frequency}</span>
          <span className="dot-sep">·</span>
          <span>{task.recipients.length} recipient{task.recipients.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {task.nextExecution && task.status === 'approved' && (
        <div className="task-card-next">
          <Clock size={12} />
          {isDue
            ? 'Due now — executing shortly'
            : `Next: ${formatDistanceToNow(new Date(task.nextExecution), { addSuffix: true })}`}
        </div>
      )}

      {execError && (
        <div className="task-exec-error">
          <AlertTriangle size={12} />
          <span>{execError}</span>
        </div>
      )}

      {(task.status === 'approved' || task.status === 'failed') && address && (
        <button
          className="task-run-btn"
          onClick={() => {
            if (task.status === 'failed') updateTask(task.id, { status: 'approved' })
            runNow()
          }}
          disabled={running}
        >
          {running
            ? <><Loader size={13} className="spin" /> Executing…</>
            : task.status === 'failed'
              ? <><RefreshCw size={13} /> Retry</>
              : <><Play size={13} /> Run now</>}
        </button>
      )}

      {task.txHashes.length > 0 && task.status === 'completed' && (
        <div className="task-tx-demo-note">✓ Paid on Base via MetaMask</div>
      )}

      {task.txHashes.length > 0 && (
        <div className="task-card-txs">
          {task.txHashes.map((hash) => {
            const isPending = hash.startsWith('pending:')
            const taskRef = isPending ? hash.replace('pending:', '') : null
            const explorer = task.txExplorer ?? 'https://basescan.org/tx/'
            return isPending ? (
              <span key={hash} className="task-tx-link pending" title={`Task: ${taskRef}`}>
                <Loader size={11} className="spin" /> confirming on Base…
              </span>
            ) : (
              <a
                key={hash}
                href={`${explorer}${hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="task-tx-link"
              >
                <ExternalLink size={11} />
                {hash.slice(0, 10)}…{hash.slice(-6)}
              </a>
            )
          })}
        </div>
      )}

      <div className="task-card-recipients">
        {task.recipients.map((r, i) => (
          <div key={i} className="task-recipient-row">
            <span className="task-recipient-addr">{r.label ?? `${r.address.slice(0, 10)}…`}</span>
            <span className="task-recipient-amt">{r.amount} {task.tokenSymbol}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
