# Architecture

## Flow: x402 + Gateway batched settlement

```
Buyer  (GatewayClient · CLI / web / Gemini agent)
  │
  │ 1. Deposit USDC into GatewayWallet on Arc        (one-time onchain)
  │ 2. POST paid endpoint with prompt / goal
  ▼
Seller (apps/server · Express · createGatewayMiddleware)
  │    gateway.require("$0.05") returns HTTP 402 with requirements
  ▲
  │ 3. Buyer signs EIP-3009 TransferWithAuthorization  (offchain, zero gas)
  │ 4. Retries with PAYMENT-SIGNATURE header
  ▼
Seller
  │ 5. Middleware verifies at https://gateway-api-testnet.circle.com/v1/x402/verify
  │ 6. req.payment populated → handler runs
  │ 7. Server bills per token / runs agent / fires N authorizations
  │ 8. Middleware submits settle request to Gateway
  │ 9. On stream close: ERC-8004 giveFeedback(agentId, score, …) recorded onchain
  ▼
Circle Gateway
  │ Batches many authorizations across time + buyers
  │ Settles net positions onchain via GatewayMinter on Arc
  ▼
Arc Testnet (EVM L1 · chain 5042002)
  USDC (ERC-20 at 0x3600…)
  GatewayWallet     0x0077…
  GatewayMinter     0x0022…
  IdentityRegistry  0x8004…A818 (ERC-8004 canonical)
  ReputationRegistry 0x8004…B663 (ERC-8004 canonical)
  ValidationRegistry 0x8004…Cb1B (ERC-8004 canonical)
  ServiceRegistry (ours, optional)
  SpendingPolicy  (ours, optional)
  Attestation     (ours, optional)
```

## Components

### apps/server (Express)
- `POST /stream` — `gateway.require("$0.05")`, returns JSON with tokens array, total paid, attestation tx, reputation tx.
- `POST /chain` — `gateway.require("$0.10")`, reasoner-drafter agent chain.
- `POST /demo/run-stream` — server-side GatewayClient proxy for the web UI single/chain demo (SSE to browser).
- `POST /demo/stress` — sequential N-authorization stress runner (satisfies 50+ tx requirement).
- `POST /demo/agent` — Gemini 3 Pro Function Calling loop. Tools: `get_gateway_balance`, `deposit_usdc_to_gateway`, `pay_for_inference`.
- `GET /health` — reports Gateway readiness, seller, ERC-8004 agent ID.

### apps/web (Next.js 14)
- `/` — single-page app with 4 demo tabs.
- `/api/demo`, `/api/stress`, `/api/agent` — proxy routes to the Express server (SSE passthrough).
- Right-rail sidebar: hero $USDC metric, x402 flow timeline, payment card, live activity feed with Arcscan links.

### packages/cli
External buyer CLI using `GatewayClient` — `balance`, `deposit`, `buy`, `chain`. Useful for CLI-only demo.

### packages/mcp
MCP server exposing NanoPay's billing as a tool. Any MCP-compatible agent (Claude Code, Cursor) can invoke x402-paid Gemini.

### contracts (Foundry)
- `ServiceRegistry` — on-chain catalog of LLM endpoints with per-token USDC prices.
- `SpendingPolicy` — daily / per-stream / per-tx caps, optional safety layer.
- `Attestation` — homegrown receipt anchor.

ERC-8004 contracts are **not redeployed** — we integrate with the canonical Arc deployments.

## Why Arc

- Gemini token value ~$0.00005; Ethereum gas per tx ~$2. Ratio 40,000×.
- Arc delivers sub-cent USDC settlement with sub-second finality.
- Circle Nanopayments (Gateway + x402 + EIP-3009) turns N offchain authorizations into one onchain batch.
- The marginal per-token settlement cost approaches zero as batches grow.

## Track coverage

1. **Usage-Based Compute Billing** — primary. Per-token pricing.
2. **Per-API Monetization** — `gateway.require()` per request.
3. **Agent-to-Agent Payment Loop** — Pro → Flash chain.
4. **Real-Time Micro-Commerce** — token-by-token commerce.
5. **Google Prize** — Gemini 3 + Function Calling for autonomous Circle API use.
