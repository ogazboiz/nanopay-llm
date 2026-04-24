# Architecture

## Flow: x402 + Gateway batched settlement

```
Buyer (GatewayClient, CLI or web demo)
  │
  │ 1. Deposit 1 USDC into GatewayWallet contract on Arc   (one-time, onchain)
  │ 2. POST /stream with { prompt, maxUsd }
  ▼
Seller (apps/server, Express)
  │   gateway.require("$0.05") middleware
  │      → returns 402 Payment Required with x402 requirements
  ▲
  │ 3. Buyer signs EIP-3009 TransferWithAuthorization (offchain, zero gas)
  │ 4. Retries POST /stream with PAYMENT-SIGNATURE header
  ▼
Seller
  │ 5. Middleware calls Gateway facilitator
  │      POST https://gateway-api-testnet.circle.com/v1/x402/verify
  │    Payment verified → req.payment populated
  │ 6. Streams Gemini tokens via SSE; per-token offchain counter
  │ 7. On close, middleware submits authorization to
  │      POST /v1/x402/settle
  ▼
Circle Gateway
  │ 8. Gateway batches many authorizations across time/users
  │ 9. Settles net positions onchain via GatewayMinter on Arc
  ▼
Arc Testnet (EVM L1, chain 5042002)
  - USDC (ERC-20 at 0x3600...)
  - GatewayWallet contract (0x0077...)
  - GatewayMinter contract (0x0022...)
  - SpendingPolicy (ours, optional on-chain spend caps)
  - ServiceRegistry (ours, on-chain LLM catalog)
  - Attestation (ours, optional receipt anchor)
```

## Components

### apps/server
Express server with `createGatewayMiddleware`. Two paid routes:
- `POST /stream` — `gateway.require("$0.05")`, streams Gemini tokens.
- `POST /chain` — `gateway.require("$0.10")`, agent-to-agent reasoner → drafter.

Also exposes:
- `POST /demo/run-stream` — internal wallet hits the paid routes via GatewayClient so the web UI can show the full buyer flow without the user holding a key.
- `GET /health` — reports gateway readiness, network, seller address.

Billing is offchain per-token accounting. Settlement is delegated to Circle Gateway via the facilitator.

### apps/web
Next.js UI. Calls `/api/demo` (proxy to server's `/demo/run-stream`). Displays live token stream + x402 flow events (deposit, payment verify, settlement tx on Arcscan).

### packages/cli
External buyer CLI using `GatewayClient` from `@circle-fin/x402-batching/client`:
- `nanopay balance` — show Gateway available/withdrawing/withdrawable USDC.
- `nanopay deposit <amount>` — one-time onchain deposit to GatewayWallet.
- `nanopay buy` — x402-paid single-stream LLM call.
- `nanopay chain` — x402-paid agent-to-agent call.

Reads `PRIVATE_KEY` from env. This is the authentic external-buyer demo path.

### packages/mcp
MCP server exposing NanoPay as tools (`stream_chat`, `list_models`) so any MCP-compatible agent (Claude Code, Cursor, custom agents) can invoke x402-paid Gemini through a standard protocol.

### contracts
Optional safety and attestation layers (not required for x402/Gateway flow):
- `ServiceRegistry` — register LLM endpoints with per-token USDC prices.
- `SpendingPolicy` — daily, per-stream, per-tx USD-denominated caps, enforced onchain.
- `Attestation` — receipt for each closed stream (tokens, total paid, quality score).

Deployed via `forge script script/Deploy.s.sol`.

### packages/shared
Shared TypeScript types for requests, events, providers, and policies.

## Why Nanopayments on Arc

- A Gemini Flash output token is worth ~$0.00005.
- On Ethereum, a single settlement tx costs ~$2. Ratio 40,000×. Economically dead.
- Per-call EVM settlements break down the moment you try to bill per token, per second, or per unit of compute.
- Circle Nanopayments batches many offchain signed authorizations into single onchain settlements on Arc. Arc delivers sub-cent USDC fees and sub-second finality.
- A 500-token chat becomes 500 offchain authorizations plus one (or a few) onchain batch. The marginal settlement cost per token approaches zero.

## Tracks covered

1. Usage-Based Compute Billing — primary. Per-token billing.
2. Per-API Monetization — `gateway.require()` per-request.
3. Agent-to-Agent Payment Loop — Pro → Flash chain.
4. Real-Time Micro-Commerce — token-by-token commerce.
5. Google Prize — Gemini 3 Flash and Pro are core models.
