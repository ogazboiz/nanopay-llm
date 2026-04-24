# NanoPay LLM

Per-output-token billing for AI inference, settled on-chain in USDC on Arc via Circle Nanopayments.

## What it does

Every token an LLM generates triggers a sub-cent USDC nanopayment on Arc. Users pay for exactly what they consume. Stop reading mid-response, billing halts instantly. No subscriptions, no prepaid credits, no overcharge.

## Why it needs Arc

- Gemini bills per output token at fractions of a cent.
- Passing through that cost in real time requires per-token on-chain settlement.
- Ethereum gas is around $2 per tx. A single token is worth $0.0001. Off by 20,000x.
- Arc delivers sub-cent USDC fees and sub-second finality, which is the only environment where per-token settlement is economically viable.

## Features

- **Per-token streaming billing**: every output token from Gemini fires a USDC nanopayment on Arc.
- **On-chain spending policy**: per-stream caps enforced by contract. Blown budget halts the stream automatically.
- **Agent-to-agent chains**: Gemini Pro can sub-call Gemini Flash, each hop billed per token on-chain.
- **x402 per-request mode**: non-streaming endpoints (embeddings, single completions) billed per call via x402 facilitator.
- **Service registry**: on-chain catalog of priced LLM endpoints. Agents query and route to the cheapest model that meets their constraints.
- **Receipt attestations**: every stream closes with an on-chain record of tokens paid and quality signal.
- **MCP server**: exposes billing as a tool so any MCP-compatible agent can plug in.
- **CLI**: one-command model registration.

## Tracks

- Usage-Based Compute Billing (primary)
- Per-API Monetization (x402 layer)
- Agent-to-Agent Payment Loop (Pro to Flash sub-calls)
- Real-Time Micro-Commerce (token-by-token commerce)
- Google Prize (Gemini + Function Calling)

## Stack

- **Settlement**: Arc L1, USDC, Circle Nanopayments
- **Wallets**: Circle Wallets
- **Payment protocols**: Circle Nanopayments (per-token), x402 (per-request)
- **LLM**: Gemini 3 Flash and Pro
- **Agent interface**: MCP server, CLI

## Status

Early build. Hackathon dates: April 20 to 26, 2026.
