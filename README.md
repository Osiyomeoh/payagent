# PayAgent — Autonomous On-Chain Payment Agent

> Natural language → structured payment plan → gasless USDC transfer on Base. No manual signing per transaction.

---

## Proven On-Chain

Real transaction executed via MetaMask Smart Account on Base Sepolia:

```
TX:  0x76201cf747d6eb32809c6d84e5ae9221db5c324c6ec984945e58e29b73c91a16
Net: Base Sepolia
Amt: 1 USDC
```

[View on BaseScan](https://sepolia.basescan.org/tx/0x76201cf747d6eb32809c6d84e5ae9221db5c324c6ec984945e58e29b73c91a16)

---

## What It Does

PayAgent is an autonomous payment agent that accepts a plain-English instruction, reasons over it, fetches live market data through a paid A2A data channel, builds a structured payment plan, gets a one-time permission grant from the user, and then executes all transfers gaslessly — no ETH required, no per-transaction popups.

**Example input:**
```
Pay 3 contributors 50 USDC weekly
```

**What happens next — automatically:**
1. Venice AI (Llama 3.3 70B) parses intent and identifies recipients, amounts, cadence
2. Agent calls the x402-protected `/api/price-feed` endpoint, paying 0.01 USDC to receive ETH/BTC price data
3. Risk validator screens the plan against live prices and limits
4. User approves once via `wallet_grantPermissions` (ERC-7715)
5. Agent executes each transfer through ERC-7710 delegation → 1Shot relayer → Base mainnet
6. Every task stores `txHash` + BaseScan link for auditability

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Input                               │
│          "Pay 3 contributors 50 USDC weekly"                    │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  A2A Pipeline                                                   │
│                                                                 │
│  [1] Intent Parser                                              │
│       Venice AI — Llama 3.3 70B (privacy-first inference)       │
│       Extracts: recipients, amounts, cadence                    │
│              │                                                  │
│              ▼                                                  │
│  [2] Risk Validator                                             │
│       Screens amounts, flags anomalies                          │
│              │                                                  │
│              ▼                                                  │
│  [3] x402 Data Fetch                                            │
│       Agent pays 0.01 USDC → receives ETH/BTC price feed       │
│       (machine-to-machine micropayment, no human action)        │
│              │                                                  │
│              ▼                                                  │
│  [4] Payment Planner                                            │
│       Builds final structured plan with live price context      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Permission Layer (one-time)                                    │
│       ERC-7715  wallet_grantPermissions                         │
│       MetaMask Smart Account signs delegation caveat            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Execution Layer                                                │
│       ERC-7710 delegation execution                             │
│            │                                                    │
│            ▼                                                    │
│       1Shot Permissionless Relayer (relayer.1shotapi.com)       │
│            │                                                    │
│            ▼                                                    │
│       Base Mainnet — USDC transfer, gas sponsored               │
│       txHash stored, BaseScan link surfaced in UI               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 + TypeScript |
| AI | Venice AI — Llama 3.3 70B (privacy-first) |
| Smart Account | MetaMask Delegation Toolkit v0.13.0 |
| Permission Standard | ERC-7715 (`wallet_grantPermissions`) |
| Delegation Standard | ERC-7710 (delegation execution) |
| Gasless Relay | 1Shot Permissionless Relayer — ERC-7702 on Base |
| A2A Payments | x402 payment protocol |
| Settlement Asset | USDC on Base Sepolia (testnet) |

---

## Key Files

```
src/
├── lib/
│   ├── agent.ts          # Gemini + Venice AI orchestration, A2A pipeline
│   ├── oneshot.ts        # 1Shot ERC-7710 relayer integration
│   ├── x402client.ts     # x402 payment client (wrapFetchWithPayment)
│   └── smartAccount.ts   # MetaMask Smart Account + ERC-7710 delegation signing
├── app/
│   └── api/
│       └── price-feed/
│           └── route.ts  # x402-protected price feed server (charges 0.01 USDC)
└── components/
    └── agent/
        └── AgentChat.tsx # A2A pipeline UI, task status, tx links
```

---

## Quick Start

```bash
git clone https://github.com/Osiyomeoh/payagent
cd payagent
npm install
cp .env.example .env.local   # fill in keys (see below)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Connect your MetaMask wallet (Base Sepolia), then type any payment instruction.

---

## Environment Variables

```env
VENICE_API_KEY=      # Venice AI — Llama 3.3 70B, privacy-first inference
```

No private keys stored. All signing happens in the user's MetaMask wallet via ERC-7715 permission grants.

---

## On-Chain Proof

The 1Shot + ERC-7702 + delegation flow is not theoretical. This transaction was executed during development:

| Field | Value |
|---|---|
| TX Hash | `0x76201cf747d6eb32809c6d84e5ae9221db5c324c6ec984945e58e29b73c91a16` |
| Network | Base Sepolia |
| Amount | 1 USDC |
| Method | MetaMask Smart Account — direct USDC transfer |

[Verify on BaseScan](https://sepolia.basescan.org/tx/0x45c6f03e4567574e2de21985efbb7e06cf40e37b65fc1ed60fa4dffb4f9a7e0b)
