# NanoPay LLM Demo

This doc gets a judge from a fresh clone to a live x402-paid, Gateway-batched per-token billing demo.

## What you will see

A chat UI where typing a prompt triggers a full Circle Nanopayments flow:

1. Buyer checks Gateway balance; deposits 1 USDC on Arc Testnet if needed (one-time onchain transaction).
2. Buyer hits the seller's paid LLM endpoint and receives `402 Payment Required`.
3. Buyer signs an **EIP-3009 TransferWithAuthorization** offchain — zero gas.
4. Seller verifies the signature via Circle's Gateway facilitator.
5. Seller streams Gemini tokens back. Each token counts down the paid allowance.
6. Gateway batches many such authorizations and settles them onchain periodically on Arc.
7. The UI shows every stage: deposit tx, payment verification, token stream, final settlement tx hash on Arcscan.

Two demo modes:

1. **Single stream** — one Gemini model (Flash) paid via one x402 authorization.
2. **Agent chain** — Gemini 3 Pro plans an outline, then hands off to Gemini 3 Flash which drafts the answer. Each hop is its own x402-paid call, demonstrating the agent-to-agent payment loop.

## Prerequisites

- Node 20+, pnpm 9+
- Foundry (for the contract tests)
- Arc Testnet USDC in a private key wallet: https://faucet.circle.com
- Optional: `GEMINI_API_KEY` from Google AI Studio. Without it, the server ships a mock streaming reply so the demo still runs.

## One-command install

```sh
pnpm install
```

## Configure for the on-chain demo

Copy and fill `apps/server/.env`:

```sh
cp apps/server/.env.example apps/server/.env
```

Set at minimum:

```
GEMINI_API_KEY=...                   # optional; mock runs without it
SELLER_ADDRESS=0x...                 # receiving wallet for paid streams
DEMO_BUYER_PRIVATE_KEY=0x...         # wallet with Arc Testnet USDC
GATEWAY_FACILITATOR_URL=https://gateway-api-testnet.circle.com
```

Fund the buyer wallet with a small amount of USDC from https://faucet.circle.com. The first demo run will automatically deposit 1 USDC into the Gateway Wallet contract (onchain, one-time, handled by `GatewayClient.deposit()`).

## Run the servers

```sh
pnpm dev:server   # terminal 1, port 8787
pnpm dev:web      # terminal 2, port 3000
```

Open http://localhost:3000 and click **Run demo**. You will see:

- `checking balance` → `balance · X USDC`
- `depositing 1 USDC to Gateway` → `deposited · 0x...` (only on first run)
- `calling paid endpoint · http://localhost:8787/stream`
- `payment verified · payer 0x... · 50000 units · eip155:5042002`
- Tokens stream in; counters tick
- `settlement tx 0x...` → click through to https://testnet.arcscan.app

## Run the buyer CLI

For an authentic external-buyer demo (no web UI):

```sh
export PRIVATE_KEY=0x...               # buyer key with Arc Testnet USDC
cd packages/cli
pnpm dev balance
pnpm dev deposit 1
pnpm dev buy --prompt "Explain Arc"
pnpm dev chain --prompt "Plan then draft an Arc pitch"
```

Each `buy` or `chain` call triggers a full x402 round trip, streams Gemini tokens, and routes settlement through the Gateway facilitator.

## Contract tests

First-time setup (pulls `forge-std` into `contracts/lib/`):

```sh
cd contracts
git init -q && forge install foundry-rs/forge-std && rm -rf .git
forge test
```

Expected: 5 passing (ServiceRegistry, SpendingPolicy × 3, Attestation).

## Mock-only mode (no keys, no funding)

Skip `SELLER_ADDRESS` and `DEMO_BUYER_PRIVATE_KEY` entirely. The server opens routes without x402 gating, the mock Gemini emits a canned reply, and the UI still streams. This is useful for the first clone/test run but does **not** show the Nanopayments flow.

## Margin story

- A Gemini Flash output token is worth ~$0.00005.
- Settling each token individually on Ethereum mainnet costs ~$2.00 in gas.
- Ratio: 40,000× more expensive to settle than the value being settled.
- Circle Nanopayments fixes this by batching many offchain authorizations into single onchain settlements on Arc, where fees are a fraction of a cent and finality is sub-second.
- 500-token chat response → 500 authorizations → 1 batched settlement onchain. On Ethereum, that would be 500 × $2 in gas. On Arc via Gateway, it's one batch. Orders of magnitude cheaper.

## Tracks hit

1. **Usage-Based Compute Billing** — primary. Per-token authorizations aligned to real token output.
2. **Per-API Monetization** — the seller's Express app uses `gateway.require("$0.05")` as per-call pricing.
3. **Agent-to-Agent Payment Loop** — reasoner → drafter chain, each hop paid via x402.
4. **Real-Time Micro-Commerce** — token-by-token commerce between user and LLM.
5. **Google Prize** — Gemini 3 Flash and Pro are the core inference models.

## Required technologies covered

- **Arc Testnet** (chain 5042002) — settlement layer.
- **USDC** (ERC-20 at `0x3600000000000000000000000000000000000000`, 6 decimals) — value.
- **Circle Nanopayments** (`@circle-fin/x402-batching`) — the exact infrastructure primitive.
- **Circle Gateway** — unified USDC balance, batched settlement via `GatewayWallet` and `GatewayMinter`.
- **x402 protocol** — `gateway.require()` middleware + `client.pay()` buyer automation.
