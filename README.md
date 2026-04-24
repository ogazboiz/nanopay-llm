# NanoPay LLM

Per-output-token USDC billing for AI inference, settled via **Circle Nanopayments** on **Arc Testnet**.

## What it does

Every token an LLM generates is paid for with a sub-cent USDC authorization, batched and settled onchain by Circle Gateway. Users sign **one** offchain EIP-3009 authorization and receive hundreds of tokens. Stop reading mid-response, no further settlement happens. No subscriptions, no prepaid credits, no overcharge.

## Why it needs Arc

- Gemini bills per output token at fractions of a cent.
- Ethereum gas per transaction is around $2; a single token is worth $0.0001. Settling each one individually is off by 20,000×.
- Circle Nanopayments batches many offchain authorizations into single onchain settlements via Circle Gateway.
- Arc gives sub-cent USDC fees and sub-second finality. The marginal per-token settlement cost approaches zero. This is the only environment where per-token billing is economically viable.

## Required technology used

- **Arc Testnet** (chain 5042002) — EVM L1 for all settlement.
- **USDC** — native gas and payment asset on Arc.
- **Circle Nanopayments** (`@circle-fin/x402-batching`) — the exact infrastructure primitive.
- **Circle Gateway** — unified USDC balance, facilitator for verify + settle.
- **x402 protocol** — web-native 402 Payment Required standard.

## Features

- `gateway.require("$X.XX")` middleware on the seller. `GatewayClient.pay()` on the buyer.
- Per-token streaming billing via Gemini, counted offchain.
- Agent-to-agent payment chain: Gemini 3 Pro plans, Gemini 3 Flash drafts, each hop is a separate x402-paid call.
- On-chain safety contracts (Foundry): ServiceRegistry, SpendingPolicy, Attestation.
- MCP server exposing NanoPay as tools for any MCP-compatible agent.
- CLI buyer (`nanopay balance / deposit / buy / chain`) for the authentic external-buyer demo.
- Web UI with live x402 flow events and Arcscan links.

## Tracks

- Usage-Based Compute Billing (primary)
- Per-API Monetization (`gateway.require()`)
- Agent-to-Agent Payment Loop (Pro → Flash)
- Real-Time Micro-Commerce
- Google Prize (Gemini)

## Quickstart

```sh
pnpm install
cp apps/server/.env.example apps/server/.env
# edit .env: set GEMINI_API_KEY (optional), SELLER_ADDRESS, DEMO_BUYER_PRIVATE_KEY
pnpm dev:server    # terminal 1
pnpm dev:web       # terminal 2
```

Open http://localhost:3000, click **Run demo**. See `DEMO.md` for the full walkthrough.

## Layout

```
apps/server       Express seller + Gateway middleware + Gemini proxy
apps/web          Next.js UI with live x402 flow visualization
packages/cli      External buyer CLI using GatewayClient
packages/mcp      MCP server exposing NanoPay as agent tools
packages/shared   Shared TypeScript types
contracts         Foundry Solidity: ServiceRegistry, SpendingPolicy, Attestation
```

## Hackathon

[Agentic Economy on Arc](https://lablab.ai) — April 20-26, 2026.
