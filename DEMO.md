# NanoPay LLM Demo

This doc gets a judge from a fresh clone to a live per-token billing demo in under 5 minutes.

## What you will see

A chat UI where typing a prompt streams tokens from Gemini. Every token fires a USDC nanopayment on Arc Testnet. The counter climbs token by token. Each settlement row links to the Arc block explorer.

Two demo modes:

1. **Single stream** — one Gemini model (Flash) billed per output token.
2. **Agent chain** — Gemini 3 Pro plans an outline, then hands off to Gemini 3 Flash which drafts the answer. Each hop opens its own on-chain stream and settles per token.

## Prerequisites

- Node 20+ and pnpm 9+
- Foundry (for contract tests)
- Optional: `GEMINI_API_KEY` from Google AI Studio. Without it, the server ships a mock streaming reply so the demo still runs.
- Optional: Arc Testnet deployer key with USDC from https://faucet.circle.com and a deployed set of contracts. Without these, the server runs in pass-through mode (tx hashes are the zero hash; the UI still flows).

## One-command install

```sh
pnpm install
```

## Run the demo (mock mode, no keys needed)

```sh
pnpm dev:server   # terminal 1, port 8787
pnpm dev:web      # terminal 2, port 3000
```

Open http://localhost:3000. Click **Stream**. A mock reply streams in token by token with a live counter.

Click **Agent chain (Pro → Flash)** to see the two-hop pattern. The reasoner output fills first, then the drafter.

## Run the demo (Gemini live, no chain)

Copy `apps/server/.env.example` to `apps/server/.env`, set `GEMINI_API_KEY`, restart the server. Tokens stream from Gemini; settlement stays mocked (zero hash).

## Run the demo (Gemini + Arc live)

1. Get Arc Testnet USDC from https://faucet.circle.com.
2. Deploy contracts:
   ```sh
   cd contracts
   DEPLOYER_PRIVATE_KEY=0x... forge script script/Deploy.s.sol --rpc-url arc_testnet --broadcast
   ```
3. Paste the three deployed addresses into `apps/server/.env`:
   ```
   SERVICE_REGISTRY_ADDRESS=0x...
   SPENDING_POLICY_ADDRESS=0x...
   ATTESTATION_ADDRESS=0x...
   SERVICE_WALLET_PRIVATE_KEY=0x...
   ```
4. From a user wallet, call `SpendingPolicy.setPolicy(dailyCap, perStreamCap, perTxCap)` and `USDC.approve(serviceWallet, allowance)`.
5. Restart the server and stream. Every token now fires a real `transferFrom` on Arc. Click any tx hash in the settlement list to view it on https://testnet.arcscan.app.

## Contract tests

First-time setup (pulls `forge-std` into `contracts/lib/`):

```sh
cd contracts
git init -q && forge install foundry-rs/forge-std && rm -rf .git
forge test
```

Expected: 5 passing (ServiceRegistry, SpendingPolicy × 3, Attestation).

## Margin story for judges

- A Gemini Flash output token is worth ~$0.00005.
- Settling each token on Ethereum mainnet costs ~$2.00 in gas.
- Ratio: settlement cost is 40,000× the value settled. The model collapses.
- On Arc Testnet, settlement is a fraction of a cent with sub-second finality. The same 500-token reply produces 500 settlements and the gas floor never swallows the product.

A one-minute chat produces 200 to 500 tokens. That is 200 to 500 on-chain transactions per interaction. The hackathon requirement is 50+.

## Submission tracks hit

1. **Usage-Based Compute Billing** — primary. Per-token settlement aligned with usage.
2. **Per-API Monetization** — Gemini proxy is a pay-per-call API gated by USDC.
3. **Agent-to-Agent Payment Loop** — reasoner-drafter chain, each hop billed per token.
4. **Real-Time Micro-Commerce** — token-by-token commerce between user and LLM.
5. **Google Prize** — Gemini 3 Flash and Pro are the core inference models.
