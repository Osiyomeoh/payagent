'use client'

import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store'
import { executeTask, getNextExecution } from '@/lib/executor'

const POLL_INTERVAL = 15_000 // check every 15s

export function useTaskExecutor() {
  const { tasks, address, chainId, isConnected, updateTask } = useAppStore()
  const runningRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!isConnected || !address || !chainId) return

    const interval = setInterval(() => {
      const now = Date.now()

      for (const task of tasks) {
        if (task.status !== 'approved') continue
        if (runningRef.current.has(task.id)) continue
        // One-time tasks must be run manually via "Run now" button
        if (task.frequency === 'once') continue
        if (task.nextExecution && new Date(task.nextExecution).getTime() > now) continue

        runningRef.current.add(task.id)
        updateTask(task.id, { status: 'executing' })

        executeTask(task, address, chainId)
          .then(({ txHashes, isSimulated, explorer }) => {
            const isRecurring = task.frequency !== 'once'
            updateTask(task.id, {
              status: isRecurring ? 'approved' : 'completed',
              txHashes: [...task.txHashes, ...txHashes],
              txSimulated: isSimulated,
              txExplorer: explorer,
              nextExecution: isRecurring ? getNextExecution(task.frequency) : undefined,
            })
          })
          .catch((err) => {
            console.error('Task execution failed:', err)
            updateTask(task.id, { status: 'failed' })
          })
          .finally(() => {
            runningRef.current.delete(task.id)
          })
      }
    }, POLL_INTERVAL)

    return () => clearInterval(interval)
  }, [tasks, address, chainId, isConnected, updateTask])
}
