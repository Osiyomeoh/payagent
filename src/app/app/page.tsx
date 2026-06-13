'use client'

import { useState } from 'react'
import { Bot, LayoutDashboard, Settings, Zap } from 'lucide-react'
import AgentChat from '@/components/agent/AgentChat'
import TaskDashboard from '@/components/dashboard/TaskDashboard'
import SettingsPanel from '@/components/ui/SettingsPanel'
import WalletButton from '@/components/wallet/WalletButton'
import { useAppStore } from '@/store'
import { useTaskExecutor } from '@/hooks/useTaskExecutor'

type Tab = 'agent' | 'dashboard' | 'settings'

export default function Home() {
  useTaskExecutor()
  const [tab, setTab] = useState<Tab>('agent')
  const { tasks } = useAppStore()
  const pendingCount = tasks.filter((t) => t.status === 'approved').length

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-logo">
          <Zap size={18} className="logo-icon" />
          <span className="logo-text">PayAgent</span>
          <span className="logo-badge">beta</span>
        </div>
        <nav className="app-nav">
          <button
            className={`nav-tab ${tab === 'agent' ? 'active' : ''}`}
            onClick={() => setTab('agent')}
          >
            <Bot size={14} /> Agent
          </button>
          <button
            className={`nav-tab ${tab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setTab('dashboard')}
          >
            <LayoutDashboard size={14} />
            Tasks
            {pendingCount > 0 && <span className="nav-badge">{pendingCount}</span>}
          </button>
          <button
            className={`nav-tab ${tab === 'settings' ? 'active' : ''}`}
            onClick={() => setTab('settings')}
          >
            <Settings size={14} /> Settings
          </button>
        </nav>
        <WalletButton />
      </header>

      <main className="app-main">
        {tab === 'agent' && <AgentChat />}
        {tab === 'dashboard' && <TaskDashboard />}
        {tab === 'settings' && <SettingsPanel />}
      </main>
    </div>
  )
}
