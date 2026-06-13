export type TaskStatus = 'pending' | 'approved' | 'executing' | 'completed' | 'failed'

export type TaskFrequency = 'once' | 'daily' | 'weekly' | 'monthly'

export interface Recipient {
  address: string
  amount: string
  label?: string
}

export interface PaymentTask {
  id: string
  createdAt: string
  description: string
  recipients: Recipient[]
  totalAmount: string
  tokenSymbol: string
  frequency: TaskFrequency
  nextExecution?: string
  endDate?: string
  status: TaskStatus
  txHashes: string[]
  txSimulated?: boolean
  txExplorer?: string     // base URL for the block explorer (chain-specific)
  permissionId?: string
  signedDelegation?: import('@/lib/oneshot').DelegationRecord
  delegationChainId?: number
  smartAccountAddress?: string
}

export interface AgentMessage {
  id: string
  role: 'user' | 'agent'
  content: string
  timestamp: string
  taskPlan?: AgentTaskPlan
}

export interface AgentTaskPlan {
  description: string
  recipients: Recipient[]
  totalAmount: string
  tokenSymbol: string
  frequency: TaskFrequency
  endDate?: string
  estimatedGas: string
  requiresPermission: boolean
}

export interface PermissionSession {
  id: string
  grantedAt: string
  expiresAt: string
  spendLimit: string
  tokenSymbol: string
  address: string
}
