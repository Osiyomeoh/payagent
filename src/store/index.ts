import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { AgentMessage, PaymentTask, PermissionSession } from '@/types'

interface AppStore {
  address: string | null
  chainId: number | null
  isConnected: boolean
  setWallet: (address: string, chainId: number) => void
  disconnectWallet: () => void

  smartAccountAddress: string | null
  smartAccountDeployed: boolean
  setSmartAccount: (address: string, isDeployed: boolean) => void
  clearSmartAccount: () => void

  permissionSession: PermissionSession | null
  setPermissionSession: (session: PermissionSession) => void
  clearPermissionSession: () => void

  messages: AgentMessage[]
  addMessage: (msg: AgentMessage) => void
  clearMessages: () => void
  isAgentThinking: boolean
  setAgentThinking: (v: boolean) => void
  agentStage: string
  setAgentStage: (stage: string) => void

  tasks: PaymentTask[]
  addTask: (task: PaymentTask) => void
  updateTask: (id: string, updates: Partial<PaymentTask>) => void
  clearTasks: () => void

  geminiApiKey: string
  setGeminiApiKey: (key: string) => void
  veniceApiKey: string
  setVeniceApiKey: (key: string) => void
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      address: null,
      chainId: null,
      isConnected: false,
      setWallet: (address, chainId) => set({ address, chainId, isConnected: true }),
      disconnectWallet: () => set({
        address: null, chainId: null, isConnected: false,
        permissionSession: null, smartAccountAddress: null, smartAccountDeployed: false,
      }),

      smartAccountAddress: null,
      smartAccountDeployed: false,
      setSmartAccount: (address, isDeployed) => set({ smartAccountAddress: address, smartAccountDeployed: isDeployed }),
      clearSmartAccount: () => set({ smartAccountAddress: null, smartAccountDeployed: false }),

      permissionSession: null,
      setPermissionSession: (session) => set({ permissionSession: session }),
      clearPermissionSession: () => set({ permissionSession: null }),

      messages: [],
      addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
      clearMessages: () => set({ messages: [] }),
      isAgentThinking: false,
      setAgentThinking: (v) => set({ isAgentThinking: v }),
      agentStage: '',
      setAgentStage: (stage) => set({ agentStage: stage }),

      tasks: [],
      addTask: (task) => set((s) => ({ tasks: [task, ...s.tasks] })),
      updateTask: (id, updates) => set((s) => ({ tasks: s.tasks.map((t) => t.id === id ? { ...t, ...updates } : t) })),
      clearTasks: () => set({ tasks: [] }),

      geminiApiKey: '',
      setGeminiApiKey: (key) => set({ geminiApiKey: key }),
      veniceApiKey: '',
      setVeniceApiKey: (key) => set({ veniceApiKey: key }),
    }),
    {
      name: 'payagent-store',
      partialize: (s) => ({
        tasks: s.tasks,
        // messages intentionally NOT persisted — chat resets on each visit
        geminiApiKey: s.geminiApiKey,
        veniceApiKey: s.veniceApiKey,
        permissionSession: s.permissionSession,
        smartAccountAddress: s.smartAccountAddress,
        smartAccountDeployed: s.smartAccountDeployed,
      }),
    }
  )
)
