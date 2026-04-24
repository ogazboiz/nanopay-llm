# NanoPay LLM

**Per-output-token USDC billing for AI inference**, settled via **Circle Nanopayments** on **Arc Testnet**.
Built for the [Agentic Economy on Arc hackathon](https://lablab.ai) · April 20-26, 2026.

## What this is

Every output token Gemini generates is paid for with a sub-cent USDC authorization, signed offchain via **EIP-3009**, batched and settled onchain by **Circle Gateway**. Stop reading mid-response, billing stops.

A 500-token chat becomes 500 offchain authorizations collapsing into a batched onchain settlement. The per-token settlement cost approaches zero — making per-token AI billing economically real for the first time.

## Four demos in one app

| Mode | What it shows |
|---|---|
| **Single stream** | One x402 authorization → Gemini 3 Flash streams tokens with a live counter |
| **Agent chain** | Gemini 3 Pro plans an outline, hands off to Gemini 3 Flash drafter — two separate x402 payments |
| **Stress** | Fire 10 / 50 / 100 / 200 sequential x402 authorizations in one click (satisfies hackathon's 50+ tx requirement) |
| **Agent (Function Calling)** | Gemini 3 Pro autonomously calls Circle APIs — `get_gateway_balance`, `deposit_usdc_to_gateway`, `pay_for_inference` — to meet a user's goal |

## Required tech, all integrated live

| Tech | How |
|---|---|
| **Arc Testnet** (5042002) | All settlement. RPC `https://rpc.testnet.arc.network` · Explorer https://testnet.arcscan.app |
| **USDC** | ERC-20 at `0x3600000000000000000000000000000000000000`, 6-decimal transfers for all billing |
| **Circle Nanopayments** | `@circle-fin/x402-batching` — `createGatewayMiddleware` on seller, `GatewayClient.pay()` on buyer |

## Recommended tech, also integrated

- **Circle Gateway** — `deposit()`, `getBalances()`, batched settlement
- **x402 facilitator** — Circle hosted at `gateway-api-testnet.circle.com`
- **ERC-8004** — canonical Arc deployments:
  - IdentityRegistry [`0x8004A818BFB912233c491871b3d84c89A494BD9e`](https://testnet.arcscan.app/address/0x8004A818BFB912233c491871b3d84c89A494BD9e)
  - ReputationRegistry [`0x8004B663056A597Dffe9eCcC1965A193B7388713`](https://testnet.arcscan.app/address/0x8004B663056A597Dffe9eCcC1965A193B7388713)
  - ValidationRegistry [`0x8004Cb1BF31DAf7788923b405b754f57acEB4272`](https://testnet.arcscan.app/address/0x8004Cb1BF31DAf7788923b405b754f57acEB4272)
  - Server registers as an agent and records `giveFeedback` on every completed stream
- **Gemini 3 Flash + Pro Preview** — streaming LLMs + Function Calling agent

## Margin story

- Gemini 3 Flash output token value: **~$0.00005**
- Ethereum mainnet settlement: **~$2.00** per tx — ratio 40,000×
- Arc Testnet + Gateway batched settlement: **sub-cent, amortized near zero**

This is the only environment where per-token onchain billing is economically viable.

## Quickstart

```sh
pnpm install
cp apps/server/.env.example apps/server/.env
# set GEMINI_API_KEY, SELLER_ADDRESS, DEMO_BUYER_PRIVATE_KEY (funded from https://faucet.circle.com)
pnpm dev:server    # :8787
pnpm dev:web       # :3000
```

Open http://localhost:3000 and click any demo mode.

## Layout

```
apps/server       Express seller · Gateway middleware · Gemini · Function Calling agent · stress runner · ERC-8004 client
apps/web          Next.js UI · 4 demo modes · x402 flow timeline · live activity feed
packages/cli      External buyer CLI (balance / deposit / buy / chain) using GatewayClient
packages/mcp      MCP server exposing NanoPay as agent tools
packages/shared   Shared TypeScript types
contracts         Foundry: ServiceRegistry, SpendingPolicy, Attestation (ERC-8004 is canonical, not redeployed)
```

## Docs

- [SUBMISSION.md](./SUBMISSION.md) — hackathon submission content, margin story, feedback, video script
- [DEMO.md](./DEMO.md) — reproducible demo walkthrough
- [ARCHITECTURE.md](./ARCHITECTURE.md) — flow diagram and component roles
- [DEPLOY.md](./DEPLOY.md) — Vercel + Railway deploy instructions
