# PayAgent — Autonomous On-Chain Payment Agent

> Natural language → structured payment plan → USDC transfer on Base. Powered by Venice AI, x402, MetaMask Smart Accounts, and 1Shot.

**Live demo:** [https://payagent-seven.vercel.app](https://payagent-seven.vercel.app)
**GitHub:** [https://github.com/Osiyomeoh/payagent](https://github.com/Osiyomeoh/payagent)

---

## Proven On-Chain

Real transaction executed via MetaMask on Base Sepolia:

```
TX:  0x76201cf747d6eb32809c6d84e5ae9221db5c324c6ec984945e58e29b73c91a16
Net: Base Sepolia
Amt: 1 USDC
```

[View on BaseScan](https://sepolia.basescan.org/tx/0x76201cf747d6eb32809c6d84e5ae9221db5c324c6ec984945e58e29b73c91a16)

---

## What It Does

PayAgent is an autonomous payment agent that accepts a plain-English instruction, reasons over it, fetches live market data through a paid A2A data channel, builds a structured payment plan, gets a one-time permission grant from the user, and then executes USDC transfers on Base.

**Example input:**
```
Pay 3 contributors 50 USDC weekly
```

**What happens next — automatically:**
1. Venice AI (Llama 3.3 70B) parses intent and identifies recipients, amounts, cadence
2. Agent calls the x402-protected `/api/price-feed` endpoint, paying 0.01 USDC to receive ETH/BTC price data
3. Risk validator screens the plan against live prices and limits
4. User approves once — MetaMask signs the ERC-7710 delegation
5. Agent executes each transfer via the 1Shot permissionless relayer on Base
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
│       ERC-7710 delegation signed via MetaMask Smart Account     │
│       User SA → 1Shot Relayer (delegation chain)                │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Execution Layer                                                │
│       1Shot Permissionless Relayer (relayer.1shotapi.com)       │
│       Base Sepolia — USDC transfer                              │
│       txHash stored, BaseScan link surfaced in UI               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 + TypeScript |
| AI | Venice AI — Llama 3.3 70B (privacy-first) |
| Smart Account | MetaMask Delegation Toolkit v0.13.0 |
| Delegation Standard | ERC-7710 (delegation execution) |
| Gasless Relay | 1Shot Permissionless Relayer |
| A2A Payments | x402 payment protocol |
| Settlement Asset | USDC on Base Sepolia |

---

## Smart Accounts Kit Usage

### Delegations

| Action | Code |
|--------|------|
| Create delegation (User SA → 1Shot target) | [`src/lib/smartAccount.ts` — `signDelegationForOneShot()`](https://github.com/Osiyomeoh/payagent/blob/main/src/lib/smartAccount.ts) |
| Redeem delegation via 1Shot relayer | [`src/app/api/execute/route.ts` — `send7710Transaction()`](https://github.com/Osiyomeoh/payagent/blob/main/src/app/api/execute/route.ts) |

**Create delegation** — uses `createDelegation` + `signDelegation` from `@metamask/delegation-toolkit`:
```typescript
// src/lib/smartAccount.ts
const unsignedDelegation = createDelegation({
  to: ONESHOT_TARGET as `0x${string}`,
  from: smartAccount.address,
  environment,
  parentDelegation: ROOT_AUTHORITY,
  scope: { type: 'erc20TransferAmount', tokenAddress: USDC_BASE, maxAmount: totalBudget },
})
const signature = await smartAccount.signDelegation({ delegation: unsignedDelegation, chainId: 8453 })
```

**Redeem delegation** — submits delegation chain to 1Shot relayer:
```typescript
// src/app/api/execute/route.ts
const relayTaskId = await send7710Transaction(signedDelegation, executions)
```

### Redelegation

Redelegation architecture is implemented in [`src/app/api/execute/route.ts`](https://github.com/Osiyomeoh/payagent/blob/main/src/app/api/execute/route.ts). The server-side PayAgent wallet signs a second delegation using the user's delegation hash as authority, creating the chain:

```
User Smart Account → PayAgent (intermediary) → 1Shot Relayer
```

```typescript
// Compute hash of Delegation A (user SA → PayAgent)
const delegation1Hash = hashTypedData({ domain, types, primaryType: 'Delegation', message: delegationA })

// Create Delegation B: PayAgent → 1Shot (redelegation)
const unsignedDelegationB = createDelegation({
  to: ONESHOT_TARGET,
  from: PAYAGENT_ADDRESS,
  environment,
  parentDelegation: delegation1Hash, // authority = hash of parent delegation
  scope: { type: 'erc20TransferAmount', tokenAddress: USDC_BASE, maxAmount: totalUsdc },
})

// Sign server-side with PayAgent private key
const signatureB = await signDelegation({
  privateKey: PAYAGENT_PK,
  delegation: unsignedDelegationB,
  delegationManager: environment.DelegationManager,
  chainId: 8453,
})

// Submit full chain [A, B] to 1Shot
await send7710Transaction([signedDelegationA, signedDelegationB], executions)
```

---

## x402 Usage

### Server — x402-protected price feed

[`src/app/api/price-feed/route.ts`](https://github.com/Osiyomeoh/payagent/blob/main/src/app/api/price-feed/route.ts)

```typescript
// Returns 402 Payment Required unless caller pays 0.01 USDC on Base Sepolia
const routeConfig: RouteConfig = {
  accepts: {
    scheme: 'exact',
    network: 'eip155:84532', // Base Sepolia
    price: '0.01',
    payTo: PAYMENT_RECIPIENT,
  },
}
export const GET = withX402(priceFeedHandler, routeConfig, server)
```

### Client — x402 payment + ERC-7710 asset transfer

[`src/lib/x402client.ts`](https://github.com/Osiyomeoh/payagent/blob/main/src/lib/x402client.ts)

```typescript
// Agent auto-pays 0.01 USDC to access the price feed — no human action
export function createX402Fetch(provider: any, ownerAddress: string) {
  const signer = toClientEvmSigner({ address, signTypedData, readContract })
  const exactScheme = new ExactEvmScheme(signer)
  return wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: 'eip155:84532', client: exactScheme }],
  })
}
```

[`src/components/agent/AgentChat.tsx`](https://github.com/Osiyomeoh/payagent/blob/main/src/components/agent/AgentChat.tsx) — x402 fetch triggered in the pipeline's `fetch` stage.

---

## 1Shot API Usage

[`src/lib/oneshot.ts`](https://github.com/Osiyomeoh/payagent/blob/main/src/lib/oneshot.ts) — full 1Shot integration including:
- `send7710Transaction()` — submits ERC-7710 delegation + executions to relayer
- `waitForTask()` — polls for on-chain confirmation
- `getTaskStatus()` — checks relay task status

[`src/app/api/execute/route.ts`](https://github.com/Osiyomeoh/payagent/blob/main/src/app/api/execute/route.ts) — server-side handler that builds the execution batch and submits to 1Shot.

```typescript
// Fee execution (required by 1Shot) + recipient transfers
const executions = [feeExecution, ...recipientExecutions]
const relayTaskId = await send7710Transaction(signedDelegation, executions)
const txHash = await waitForTask(relayTaskId, 60_000)
```

---

## Venice AI Usage

[`src/lib/agent.ts`](https://github.com/Osiyomeoh/payagent/blob/main/src/lib/agent.ts) — Venice AI is the sole LLM powering PayAgent.

```typescript
// Venice AI — Llama 3.3 70B, privacy-first inference
const res = await fetch('https://api.venice.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: { Authorization: `Bearer ${apiKey}` },
  body: JSON.stringify({
    model: 'llama-3.3-70b',
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    max_tokens: 2048,
    temperature: 0.3,
  }),
})
```

Venice parses every payment instruction, generates structured task plans, and provides the intelligence layer for the entire A2A pipeline. No other AI provider is used.

---

## Quick Start

```bash
git clone https://github.com/Osiyomeoh/payagent
cd payagent
npm install
cp .env.example .env.local
npm run dev
```

Add your `VENICE_API_KEY` in Settings (get one at [venice.ai](https://venice.ai/settings/api)).

Connect MetaMask to Base Sepolia, get test USDC at [faucet.circle.com](https://faucet.circle.com), then type any payment instruction.

---

## Environment Variables

```env
VENICE_API_KEY=      # Venice AI — Llama 3.3 70B
PAYAGENT_PRIVATE_KEY= # Server-side wallet for redelegation signing
PAYAGENT_ADDRESS=    # Derived from PAYAGENT_PRIVATE_KEY
```

---

## On-Chain Proof

| Field | Value |
|---|---|
| TX Hash | `0x76201cf747d6eb32809c6d84e5ae9221db5c324c6ec984945e58e29b73c91a16` |
| Network | Base Sepolia |
| Amount | 1 USDC |
| Method | MetaMask → Base Sepolia USDC transfer |

[Verify on BaseScan](https://sepolia.basescan.org/tx/0x76201cf747d6eb32809c6d84e5ae9221db5c324c6ec984945e58e29b73c91a16)

---

## Feedback

During the hackathon we identified the following areas for improvement in the MetaMask Smart Accounts Kit and related tooling:

- **1Shot permissionless relayer documentation** — The fee execution format and recipient whitelist behavior are not documented. We discovered through trial and error that the relayer only accepts `0xE936e8FAf4A5655469182A49a505055B71C17604` as a recipient, which significantly limits real-world use cases. Clearer docs on whitelisting and mainnet vs testnet behavior would help builders ship faster.

- **ERC-7710 redelegation examples** — There are no end-to-end examples of chained delegations (A → B → C) in the toolkit docs. We implemented it from first principles using `hashTypedData` + `signDelegation` with a server-side key, but a working reference would have saved significant time.

- **x402 facilitator network support** — The public x402.org facilitator only supports Base Sepolia. Expanding to Base mainnet would allow production deployments without custom facilitator infrastructure.

- **MetaMask Delegation Toolkit `createDelegation` scope types** — The `scope` parameter types are not fully documented; we found `erc20TransferAmount` works but the full list of supported scope types is unclear.

---

## Social Media

Follow the build journey and tag [@MetaMaskDev](https://x.com/MetaMaskDev):

- Tweet about PayAgent: share your experience using the app with `#PayAgent #MetaMask #ETHGlobal`
- Show your tx hash on BaseScan after sending a payment
- Tag [@MetaMaskDev](https://x.com/MetaMaskDev) showcasing how MetaMask Advanced Permissions streamlined the UX

---

Built for ETHGlobal 2026 · Base Sepolia · Venice AI · MetaMask · 1Shot · x402
