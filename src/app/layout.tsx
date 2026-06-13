import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PayAgent — Autonomous Web3 Payments',
  description: 'AI-powered payment agent using MetaMask Smart Accounts, Venice AI, and 1Shot relayer',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
